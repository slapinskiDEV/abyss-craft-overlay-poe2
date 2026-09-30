// Staged pool construction per branch (SoT §7.10, §13, §14.4, §14.5; spec 005 stages 1–9).
import type { AffixSide, ModifierDefinition } from '../../data/normalized/types';
import { applyMinimumModifierLevel } from '../modifiers/family-floor';
import { isOrdinarilySpawnable } from '../modifiers/spawn-weight';
import { diag, type Diagnostic, type ReasonCode } from '../diagnostics/diagnostic';
import type { CraftContext, IndexedAffix } from './context';
import type {
  BlockedModifierCandidate,
  CandidateReason,
  ConditionalModifierCandidate,
  DesecrationBranchResult,
  ModifierCandidate,
  PoolCompleteness,
  PoolSummary,
} from './types';
import type { BranchPlan } from './branches';

export interface PoolOptions {
  /** Putrefaction: regular sources only, no floors, groups only against kept affixes. */
  regularOnly: boolean;
  applyFloors: boolean;
  /** Affixes that stay on the item after the branch's removal/replacement step. */
  remaining: IndexedAffix[];
  parserPartial: boolean;
}

export interface PoolOutcome {
  result: DesecrationBranchResult;
  craftDiagnostics: Diagnostic[];
  mechanicNotes: Diagnostic[];
}

const JEWELLERY_TAGS = ['amulet', 'ring', 'belt'] as const;

const toCandidate = (m: ModifierDefinition, notes: ReasonCode[] = []): ModifierCandidate => ({
  modifierId: m.id,
  side: m.side,
  requiredLevel: m.requiredLevel,
  tierFamilyId: m.tierFamilyId,
  sourceKind: m.sourceKind,
  ...(m.lichPool ? { lichPool: m.lichPool } : {}),
  specialPools: m.specialPools,
  sourceRefs: m.sourceRefs,
  notes,
});

export function summarizePool(eligible: readonly ModifierCandidate[]): PoolSummary {
  const count = (pred: (c: ModifierCandidate) => boolean) => eligible.filter(pred).length;
  return {
    regular: count((c) => c.sourceKind === 'regular'),
    exclusive: count((c) => c.sourceKind === 'desecrated_exclusive'),
    amanamu: count((c) => c.lichPool === 'amanamu'),
    ulaman: count((c) => c.lichPool === 'ulaman'),
    kurgal: count((c) => c.lichPool === 'kurgal'),
    otherworldly: count((c) => c.specialPools.includes('otherworldly')),
    jewelExclusive: count((c) => c.specialPools.some((p) => p === 'jewel_lightless' || p === 'jewel_of_the_abyss')),
  };
}

export function buildPool(ctx: CraftContext, branch: BranchPlan, options: PoolOptions): PoolOutcome {
  const { data, item, bone } = ctx;
  const side: AffixSide = branch.side;
  const craftDiagnostics: Diagnostic[] = [];
  const mechanicNotes: Diagnostic[] = [];
  const completenessReasons: Diagnostic[] = [];
  const state: { completeness: PoolCompleteness } = { completeness: options.parserPartial ? 'base_eligibility_only' : 'final' };
  const weaken = (to: PoolCompleteness, reason: Diagnostic) => {
    if (to === 'unknown' || state.completeness === 'final') state.completeness = to;
    completenessReasons.push(reason);
  };
  if (options.parserPartial) completenessReasons.push(diag('PARSER_PARTIAL_MOD_GROUPS'));

  // Stage 1 — effective tags (SoT §7.8).
  const tags = new Set(item.baseTags);
  const modsById = new Map(data.modifiers.map((m) => [m.id, m]));
  for (const { affix } of options.remaining) {
    const candidates = affix.candidateModifierIds.map((id) => modsById.get(id)).filter((m): m is ModifierDefinition => m !== undefined);
    if (affix.addsTagsResolved && candidates[0]) for (const t of candidates[0].addsTags) tags.add(t);
    else if (candidates.some((m) => m.addsTags.length > 0) || candidates.length === 0) {
      weaken('base_eligibility_only', diag('CONDITIONAL_TAGS_INCOMPLETE'));
    }
  }

  // Existing groups: resolved affixes block; unresolved ones make candidates conditional.
  const resolvedGroups = new Map<string, IndexedAffix>();
  const unresolved: Array<{ affix: IndexedAffix; groups: Set<string> | 'unbounded' }> = [];
  for (const a of options.remaining) {
    if (a.affix.groupsResolved) for (const g of a.affix.groups) resolvedGroups.set(g, a);
    else unresolved.push({ affix: a, groups: a.affix.candidateModifierIds.length > 0 ? new Set(a.affix.possibleGroups) : 'unbounded' });
  }

  const unlocksOtherworldly = bone?.unlocksSpecialPools.includes('otherworldly') ?? false;
  const jewelleryClass = JEWELLERY_TAGS.find((t) => item.baseTags.includes(t));
  const itemLevel = item.itemLevel ?? 0;

  const blocked: BlockedModifierCandidate[] = [];
  const survivors: ModifierDefinition[] = [];
  const conditionalIdx = new Map<string, number[]>();

  for (const m of data.modifiers) {
    if (m.side !== side) continue;
    const otherworldly = m.specialPools.includes('otherworldly');
    // Universe (stages 2–4): regular rows of the base's domain, desecrated rows, Otherworldly rows.
    if (m.sourceKind === 'regular' && m.domain !== ctx.baseDomain) continue;
    const reasons: CandidateReason[] = [];

    if (options.regularOnly && m.sourceKind !== 'regular') reasons.push({ code: 'PUTREFACTION_EXCLUDES_EXCLUSIVE' });
    if (otherworldly) {
      if (!unlocksOtherworldly) reasons.push({ code: 'SOURCE_NOT_ENABLED' });
      else if (!jewelleryClass || !m.otherworldlyJewelleryClasses.includes(jewelleryClass)) reasons.push({ code: 'BASE_TAG_NOT_ELIGIBLE' });
    } else if (!isOrdinarilySpawnable(m.spawnWeights, tags)) {
      reasons.push({ code: 'BASE_TAG_NOT_ELIGIBLE' });
    }
    if (m.requiredLevel > itemLevel) reasons.push({ code: 'ITEM_LEVEL_TOO_LOW', params: { requiredLevel: m.requiredLevel } });
    const conflict = m.groups.map((g) => resolvedGroups.get(g)).find((a) => a !== undefined);
    if (conflict) {
      reasons.push({
        code: 'MOD_GROUP_CONFLICT',
        params: { affixIndex: conflict.index, ...(conflict.affix.matchedModifierId ? { modifierId: conflict.affix.matchedModifierId } : {}) },
      });
    }
    if (reasons.length > 0) {
      blocked.push({ ...toCandidate(m), reasons });
      continue;
    }
    const maybeBlockedBy = unresolved
      .filter((u) => u.groups === 'unbounded' || m.groups.some((g) => (u.groups as Set<string>).has(g)))
      .map((u) => u.affix.index);
    if (maybeBlockedBy.length > 0) conditionalIdx.set(m.id, maybeBlockedBy);
    survivors.push(m);
  }
  if (conditionalIdx.size > 0) weaken('base_eligibility_only', diag('PARSER_PARTIAL_MOD_GROUPS'));

  let pool = survivors;

  // Stage 7 — Lich force (SoT §11.3, §14.5). Floors never apply to a forced pool.
  const lichOmen = ctx.lichOmens.length === 1 ? ctx.lichOmens[0] : undefined;
  let lichForced = false;
  if (!options.regularOnly && lichOmen && lichOmen.effect.kind === 'force_lich') {
    const target = lichOmen.effect.lichPool;
    const isTarget = (m: ModifierDefinition) => m.lichPool === target && !m.lichPoolConflict;
    const forced = survivors.filter((m) => isTarget(m) && !conditionalIdx.has(m.id));
    const maybeForced = survivors.filter((m) => isTarget(m) && conditionalIdx.has(m.id));
    const blockOthers = (keep: (m: ModifierDefinition) => boolean) => {
      for (const m of survivors) {
        if (keep(m)) continue;
        const code: ReasonCode =
          m.lichPool === target && m.lichPoolConflict
            ? 'LICH_CLASSIFICATION_UNDER_REVIEW'
            : m.lichPool && m.lichPool !== target
              ? 'OTHER_LICH_BLOCKED_BY_FORCE_OMEN'
              : 'LICH_SOURCE_NOT_SELECTED';
        blocked.push({ ...toCandidate(m), reasons: [{ code }] });
      }
    };
    if (forced.length > 0 || maybeForced.length > 0) {
      lichForced = true;
      pool = [...forced, ...maybeForced];
      blockOthers(isTarget);
      if (bone?.minimumModifierLevel !== undefined) craftDiagnostics.push(diag('ANCIENT_BENEFIT_OVERRIDDEN_BY_LICH_OMEN', { omenId: lichOmen.id, currencyId: bone.id }));
      if (branch.kind === 'mark_replacement') mechanicNotes.push(diag('MARK_FLOOR_OVERRIDDEN_BY_LICH_OMEN', { omenId: lichOmen.id }));
      if (forced.length === 0) weaken('base_eligibility_only', diag('PARSER_PARTIAL_MOD_GROUPS'));
    } else {
      craftDiagnostics.push(diag('FORCED_LICH_POOL_EMPTY', { omenId: lichOmen.id }));
      if (bone?.minimumModifierLevel !== undefined) craftDiagnostics.push(diag('ANCIENT_BENEFIT_OVERRIDDEN_BY_LICH_OMEN', { omenId: lichOmen.id, currencyId: bone.id }));
      // U-013: the SoT only documents "falls back to regular modifiers".
      const floorApplies = bone?.minimumModifierLevel !== undefined || branch.kind === 'mark_replacement';
      const exclusiveSurvives = survivors.some((m) => m.sourceKind === 'desecrated_exclusive');
      if (floorApplies || exclusiveSurvives) {
        weaken('unknown', diag('UNKNOWN_LICH_FALLBACK_COMPOSITION', { omenId: lichOmen.id }));
        pool = [];
      } else {
        pool = survivors.filter((m) => m.sourceKind === 'regular');
      }
    }
  }

  // Stage 8 — Minimum Modifier Level floors (not with a forced Lich pool, not in Putrefaction).
  const floorNotes = new Set<string>();
  if (options.applyFloors && !lichForced && state.completeness !== 'unknown') {
    const floor =
      branch.kind === 'mark_replacement'
        ? Math.floor(itemLevel * (data.mechanicsConstants.markFloorFactor?.value ?? Number.NaN))
        : bone?.minimumModifierLevel;
    if (floor !== undefined) {
      if (Number.isNaN(floor)) {
        weaken('unknown', diag('RULE_EVIDENCE_MISSING'));
        pool = [];
      } else {
        const { kept, removed, fallbackTierIds } = applyMinimumModifierLevel(pool, floor);
        for (const m of removed) blocked.push({ ...toCandidate(m), reasons: [{ code: 'BELOW_MINIMUM_MODIFIER_LEVEL', params: { floor } }] });
        for (const id of fallbackTierIds) floorNotes.add(id);
        pool = kept;
      }
    }
  }

  // Stage 9 — final lists.
  const notes = (m: ModifierDefinition): ReasonCode[] => (floorNotes.has(m.id) ? ['FAMILY_FLOOR_FALLBACK_TIER'] : []);
  const eligible = state.completeness === 'unknown' ? [] : pool.filter((m) => !conditionalIdx.has(m.id)).map((m) => toCandidate(m, notes(m)));
  const conditional: ConditionalModifierCandidate[] =
    state.completeness === 'unknown'
      ? []
      : pool.filter((m) => conditionalIdx.has(m.id)).map((m) => ({ ...toCandidate(m, notes(m)), unresolvedAffixIndexes: conditionalIdx.get(m.id) ?? [] }));

  if (state.completeness === 'final' && !lichForced && eligible.some((c) => c.sourceKind === 'desecrated_exclusive')) {
    mechanicNotes.push(diag('EXCLUSIVE_OPTION_GUARANTEE_NOTE'));
  }

  const removed = branch.removed;
  return {
    result: {
      id: branch.id,
      kind: branch.kind,
      side,
      ...(removed?.affix.matchedModifierId ? { removedAffixId: removed.affix.matchedModifierId } : {}),
      ...(removed ? { removedAffixRawText: removed.affix.rawLines } : {}),
      completeness: state.completeness,
      completenessReasons,
      eligible,
      conditional,
      blocked,
      poolSummary: summarizePool(eligible),
    },
    craftDiagnostics,
    mechanicNotes,
  };
}
