// Rule registry loading and entity resolution (spec 002 "Entity resolution"). Hand-authored rule
// files hold mechanics only; game IDs and names are resolved from the snapshot, never typed.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BoneFamily, BoneTargetGroup, EvidenceLevel, LichPool, ProvenanceRecord, RuleEvidence, SpecialPool } from '../normalized/types';
import type { RawBaseItem, RawMod } from './raw-types';


export interface BoneRule {
  lookupNameEn: string;
  family: BoneFamily;
  tier: 'gnawed' | 'preserved' | 'ancient' | 'altered';
  targetGroup: BoneTargetGroup;
  maxItemLevelConstant?: string;
  minimumModifierLevelConstant?: string;
  unlocksSpecialPools: SpecialPool[];
  releaseState: 'current' | 'drop_disabled_legacy';
  evidence: RuleEvidence;
}

export type OmenEffectRule =
  | { kind: 'force_side'; side: 'prefix' | 'suffix' }
  | { kind: 'force_lich'; lichPool: LichPool }
  | { kind: 'putrefaction' }
  | { kind: 'reveal_reroll'; rerolls: number }
  | { kind: 'annul_desecrated_only' };

export interface OmenRule {
  lookupNameEn: string;
  phase: 'desecrate' | 'reveal' | 'annul';
  effect: OmenEffectRule;
  compatibleBoneFamilies: BoneFamily[] | 'any';
  evidence: RuleEvidence;
}

export interface OtherCurrencyRule { lookupNameEn: string; role: 'recovery'; evidence: RuleEvidence }
export interface ItemClassTargetRule { itemClassId: string; target: BoneTargetGroup; basis: string; evidence: RuleEvidence }
export interface AffixLimitRule { itemClassId: string; rarity: 'rare'; maxPrefixes: number; maxSuffixes: number; evidence: RuleEvidence }
export interface ConstantRule { value: number; uRef?: string; evidence: RuleEvidence }
export interface RowMatch { domain: string; generationType?: string; textIncludes: string; names?: string[] }
export interface LichOverrideRule { description: string; match: RowMatch; lichPool: LichPool; mechanic: string; reason: string; evidence: RuleEvidence }
export interface AbyssMarkRule { match: RowMatch; expectedCount: number; evidence: RuleEvidence }
export interface SpecialItemRuleInput {
  match: { uniqueNameEn?: string; itemClassId?: string; baseNamePrefix?: string };
  handling: 'unsupported_special_item' | 'special_jewel_rule';
  evidence: RuleEvidence;
}

export interface RuleRegistry {
  evidence: ProvenanceRecord[];
  bones: BoneRule[];
  omens: OmenRule[];
  otherCurrencies: OtherCurrencyRule[];
  itemClassTargets: ItemClassTargetRule[];
  affixLimits: AffixLimitRule[];
  constants: Record<string, ConstantRule>;
  lichOverrides: LichOverrideRule[];
  abyssMark: AbyssMarkRule;
  specialItems: SpecialItemRuleInput[];
}

export function loadRuleRegistry(rulesDir: string): RuleRegistry {
  const read = <T>(file: string): T => JSON.parse(readFileSync(join(rulesDir, file), 'utf8')) as T;
  return {
    evidence: [...read<ProvenanceRecord[]>('evidence-wiki.json'), ...read<ProvenanceRecord[]>('evidence-sot.json')],
    bones: read('bones.json'),
    omens: read('omens.json'),
    otherCurrencies: read('other-currencies.json'),
    itemClassTargets: read<{ targets: ItemClassTargetRule[] }>('item-class-targets.json').targets,
    affixLimits: read<{ limits: AffixLimitRule[] }>('affix-limits.json').limits,
    constants: read('mechanics-constants.json'),
    lichOverrides: read('lich-overrides.json'),
    abyssMark: read('abyss-mark.json'),
    specialItems: read('special-items.json'),
  };
}

/** SoT §5.5 app-stable key derived from the SoT lookup name (spec 002 rule 5). */
export const appStableKey = (lookupNameEn: string): string =>
  lookupNameEn.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export interface RegistryIssue { code: string; detail: string }

/** Every rule entry carries evidence whose refs resolve and none is only ASSUMPTION_BLOCKED. */
export function checkEvidence(registry: RuleRegistry, snapshotRecordIds: ReadonlySet<string>): RegistryIssue[] {
  const known = new Map<string, EvidenceLevel>(registry.evidence.map((e) => [e.id, e.evidenceLevel]));
  const entries: Array<[string, RuleEvidence | undefined]> = [
    ...registry.bones.map((b): [string, RuleEvidence] => [`bone ${b.lookupNameEn}`, b.evidence]),
    ...registry.omens.map((o): [string, RuleEvidence] => [`omen ${o.lookupNameEn}`, o.evidence]),
    ...registry.otherCurrencies.map((c): [string, RuleEvidence] => [`currency ${c.lookupNameEn}`, c.evidence]),
    ...registry.itemClassTargets.map((t): [string, RuleEvidence] => [`target ${t.itemClassId}`, t.evidence]),
    ...registry.affixLimits.map((l): [string, RuleEvidence] => [`limit ${l.itemClassId}`, l.evidence]),
    ...Object.entries(registry.constants).map(([k, c]): [string, RuleEvidence] => [`constant ${k}`, c.evidence]),
    ...registry.lichOverrides.map((o): [string, RuleEvidence] => [`lich override ${o.description}`, o.evidence]),
    ['abyss mark', registry.abyssMark.evidence],
    ...registry.specialItems.map((s): [string, RuleEvidence] => [`special ${JSON.stringify(s.match)}`, s.evidence]),
  ];
  const issues: RegistryIssue[] = [];
  for (const [label, evidence] of entries) {
    if (!evidence || evidence.evidenceRefs.length === 0) {
      issues.push({ code: 'RULE_EVIDENCE_MISSING', detail: label });
      continue;
    }
    const levels = evidence.evidenceRefs.map((ref) => (snapshotRecordIds.has(ref) ? 'VERIFIED_PRIMARY' : known.get(ref)));
    for (const [i, level] of levels.entries()) {
      if (!level) issues.push({ code: 'EVIDENCE_REF_UNKNOWN', detail: `${label}: ${evidence.evidenceRefs[i]}` });
    }
    if (evidence.evidenceLevel === 'ASSUMPTION_BLOCKED' || levels.every((l) => l === 'ASSUMPTION_BLOCKED')) {
      issues.push({ code: 'RULE_EVIDENCE_ASSUMPTION_BLOCKED', detail: label });
    }
  }
  for (const bone of registry.bones) {
    for (const key of [bone.maxItemLevelConstant, bone.minimumModifierLevelConstant]) {
      if (key && !registry.constants[key]) issues.push({ code: 'CONSTANT_UNKNOWN', detail: `${bone.lookupNameEn}: ${key}` });
    }
  }
  return issues;
}

export interface ResolvedEntity { lookupNameEn: string; id: string; gameMetadataId: string; canonicalNameEn: string }

export interface ResolutionResult<T> { resolved: T[]; issues: RegistryIssue[] }

/** Resolve SoT-named currencies/Omens to exactly one base_items record (spec 002 steps 0–5). */
export function resolveByName(
  lookupNames: readonly string[],
  bases: Readonly<Record<string, RawBaseItem>>,
): ResolutionResult<ResolvedEntity> {
  const resolved: ResolvedEntity[] = [];
  const issues: RegistryIssue[] = [];
  const keys = new Set<string>();
  for (const lookupNameEn of lookupNames) {
    const hits = Object.keys(bases).filter((id) => bases[id]?.name === lookupNameEn);
    const [only] = hits;
    if (hits.length !== 1 || !only) {
      issues.push({ code: hits.length === 0 ? 'ENTITY_UNRESOLVED' : 'ENTITY_AMBIGUOUS', detail: `${lookupNameEn}: ${hits.join(', ')}` });
      continue;
    }
    const id = appStableKey(lookupNameEn);
    if (keys.has(id)) issues.push({ code: 'APP_KEY_COLLISION', detail: id });
    keys.add(id);
    resolved.push({ lookupNameEn, id, gameMetadataId: only, canonicalNameEn: bases[only]?.name ?? lookupNameEn });
  }
  return { resolved, issues };
}

/** Resolve a row description to modifier IDs; the caller checks the expected count. */
export function matchRows(match: RowMatch, mods: Readonly<Record<string, RawMod>>): string[] {
  return Object.keys(mods)
    .filter((id) => {
      const m = mods[id];
      return (
        m !== undefined &&
        m.domain === match.domain &&
        (match.generationType === undefined || m.generation_type === match.generationType) &&
        (m.text ?? '').includes(match.textIncludes) &&
        (match.names === undefined || match.names.includes(m.name))
      );
    })
    .sort();
}
