// evaluateDesecration (SoT §4.2, §14; spec 005). Pure: same input -> same output.
import type { DataPack } from '../../data/normalized/types';
import type { ParsedItem, ParserConfidence } from '../../parser/common/types';
import { diag, type Diagnostic } from '../diagnostics/diagnostic';
import { generateBranches, type BranchPlan } from './branches';
import { buildContext, type CraftContext } from './context';
import { buildPool } from './pools';
import { aggregateStatus, preValidate } from './prevalidate';
import type { BasePoolResult, DataManifestSummary, DesecrationBranchResult, DesecrationEvaluation, PoolCompleteness, RecoveryHint } from './types';

export interface EvaluateInput {
  item: ParsedItem;
  parserConfidence: ParserConfidence;
  currency: string;
  activeOmens: readonly string[];
  data: DataPack;
}

const COMPLETENESS_RANK: Record<PoolCompleteness, number> = { final: 0, base_eligibility_only: 1, unknown: 2 };

const dedupe = (items: Diagnostic[]): Diagnostic[] => {
  const seen = new Set<string>();
  return items.filter((d) => {
    const key = `${d.code}|${JSON.stringify(d.params ?? {})}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const isBlocking = (status: string) => status === 'invalid' || status === 'unsupported' || status === 'unknown';

/**
 * Base Desecration pool (SoT §14.7): the §14.4 stages on an empty affix set, Ancient floor only.
 * Reuses buildPool so floors, Lich force and U-013 behave exactly as in the item check.
 */
export function evaluateBasePool(ctx: CraftContext, parserConfidence: ParserConfidence): BasePoolResult {
  const reasons = preValidate(ctx, parserConfidence, 'base');
  if (isBlocking(aggregateStatus(reasons))) return { status: aggregateStatus(reasons), reasons: dedupe(reasons), sides: [] };
  const putrefaction = ctx.putrefaction !== undefined;
  if (putrefaction && ctx.putrefaction) {
    reasons.push(diag('ITEM_WILL_BE_CORRUPTED', { omenId: ctx.putrefaction.id }));
    if (ctx.bone?.minimumModifierLevel !== undefined) reasons.push(diag('ANCIENT_FLOOR_NOT_GUARANTEED_PUTREFACTION', { omenId: ctx.putrefaction.id, currencyId: ctx.bone.id }));
  }
  const forced = ctx.sideOmen?.effect.kind === 'force_side' ? ctx.sideOmen.effect.side : undefined;
  const sides = putrefaction || !forced ? (['prefix', 'suffix'] as const) : [forced];
  const results: DesecrationBranchResult[] = [];
  for (const side of sides) {
    const branch: BranchPlan = { id: `base:${side}:-`, kind: 'base', side };
    const outcome = buildPool(ctx, branch, { regularOnly: putrefaction, applyFloors: !putrefaction, remaining: [], parserPartial: false });
    const r = outcome.result;
    results.push({ ...r, completeness: r.completeness === 'unknown' ? 'unknown' : 'base_eligibility_only', completenessReasons: [diag('BASE_POOL_ONLY'), ...r.completenessReasons] });
    reasons.push(...outcome.craftDiagnostics);
  }
  const finalReasons = dedupe(reasons);
  const status = aggregateStatus(finalReasons);
  return { status, reasons: finalReasons, sides: isBlocking(status) ? [] : results };
}

export function evaluateDesecration(input: EvaluateInput): DesecrationEvaluation {
  const { item, parserConfidence, currency, activeOmens, data } = input;
  const ctx = buildContext(item, currency, activeOmens, data);
  const reasons: Diagnostic[] = preValidate(ctx, parserConfidence);
  const mechanicNotes: Diagnostic[] = [];
  const mode = ctx.putrefaction ? 'putrefaction' : 'desecrate';
  let branchResults: DesecrationBranchResult[] = [];
  let putrefaction: DesecrationEvaluation['putrefaction'];

  if (aggregateStatus(reasons) !== 'invalid' && aggregateStatus(reasons) !== 'unsupported' && aggregateStatus(reasons) !== 'unknown') {
    const parserPartial = parserConfidence === 'partial';
    if (ctx.putrefaction && ctx.limits) {
      // Putrefaction (SoT §11.6): regular pools only, fractured affixes stay, no floors.
      const fractured = ctx.affixes.filter((a) => a.affix.fractured);
      const free = (side: 'prefix' | 'suffix') =>
        (side === 'prefix' ? ctx.limits?.maxPrefixes ?? 0 : ctx.limits?.maxSuffixes ?? 0) - fractured.filter((a) => a.affix.side === side).length;
      const maxUnrevealed = Math.max(0, free('prefix')) + Math.max(0, free('suffix'));
      putrefaction = { maxUnrevealed, fracturedKept: fractured.length, corrupts: true };
      reasons.push(diag('ITEM_WILL_BE_CORRUPTED', { omenId: ctx.putrefaction.id }));
      if (ctx.bone?.minimumModifierLevel !== undefined) {
        reasons.push(diag('ANCIENT_FLOOR_NOT_GUARANTEED_PUTREFACTION', { omenId: ctx.putrefaction.id, currencyId: ctx.bone.id }));
      }
      mechanicNotes.push(diag('PUTREFACTION_SLOT_COUNT_WORKING_MODEL', { maxUnrevealed }));
      for (const side of ['prefix', 'suffix'] as const) {
        if (free(side) <= 0) continue;
        const branch: BranchPlan = { id: `putrefaction:${side}:-`, kind: 'putrefaction', side };
        const outcome = buildPool(ctx, branch, { regularOnly: true, applyFloors: false, remaining: fractured, parserPartial });
        branchResults.push(outcome.result);
        reasons.push(...outcome.craftDiagnostics);
        mechanicNotes.push(...outcome.mechanicNotes);
      }
    } else {
      const generated = generateBranches(ctx);
      reasons.push(...generated.diagnostics);
      if (aggregateStatus(reasons) === 'valid' || aggregateStatus(reasons) === 'valid_with_warning') {
        for (const branch of generated.branches) {
          const remaining = ctx.affixes.filter((a) => a.index !== branch.removed?.index);
          const outcome = buildPool(ctx, branch, { regularOnly: false, applyFloors: true, remaining, parserPartial });
          branchResults.push(outcome.result);
          reasons.push(...outcome.craftDiagnostics);
          mechanicNotes.push(...outcome.mechanicNotes);
        }
      }
    }
  }

  const finalReasons = dedupe(reasons);
  const status = aggregateStatus(finalReasons);
  if (status === 'invalid' || status === 'unsupported' || status === 'unknown') branchResults = [];

  const reroll = ctx.omens.find((o) => o.effect.kind === 'reveal_reroll');
  if (reroll) mechanicNotes.push(diag('ECHOES_REROLL_AVAILABLE', { omenId: reroll.id }));
  const recoveryHints: RecoveryHint[] = [];
  const annul = ctx.omens.find((o) => o.effect.kind === 'annul_desecrated_only');
  const recoveryCurrency = data.otherCurrencies.find((c) => c.role === 'recovery');
  if (annul && recoveryCurrency && item.abyss.hasRevealedDesecratedModifier) {
    recoveryHints.push({ kind: 'annul_desecrated_only', omenId: annul.id, currencyId: recoveryCurrency.id });
  }

  const poolCompleteness: PoolCompleteness =
    branchResults.length === 0
      ? 'unknown'
      : branchResults.reduce<PoolCompleteness>((worst, b) => (COMPLETENESS_RANK[b.completeness] > COMPLETENESS_RANK[worst] ? b.completeness : worst), 'final');

  const m = data.manifest;
  const dataManifest: DataManifestSummary = {
    dataPackId: m.dataPackId,
    schemaVersion: m.schemaVersion,
    targetGameVersion: m.targetGameVersion,
    repoeObservedVersion: m.repoeObservedVersion,
    generatedAt: m.generatedAt,
    validated: m.validated,
    stale: m.stale,
  };

  return {
    status,
    reasons: finalReasons,
    branches: branchResults,
    recoveryHints,
    parserConfidence,
    dataManifest,
    mode,
    poolCompleteness,
    reveal: {
      optionCount: data.mechanicsConstants.revealOptionCount?.value ?? 0,
      rerollsAvailable: reroll && reroll.effect.kind === 'reveal_reroll' ? reroll.effect.rerolls : 0,
    },
    mechanicNotes: dedupe(mechanicNotes),
    ...(putrefaction ? { putrefaction } : {}),
    basePool: evaluateBasePool(ctx, parserConfidence),
  };
}
