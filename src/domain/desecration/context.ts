// Everything the engine needs, looked up once from the data pack (no hardcoded catalog/constants).
import type {
  AffixLimit,
  BaseItemDefinition,
  BoneDefinition,
  DataPack,
  ItemClassTarget,
  OmenDefinition,
  RuleEvidence,
} from '../../data/normalized/types';
import type { ParsedAffix, ParsedItem } from '../../parser/common/types';

export interface IndexedAffix { affix: ParsedAffix; index: number }

export interface CraftContext {
  data: DataPack;
  item: ParsedItem;
  bone: BoneDefinition | undefined;
  omens: OmenDefinition[];
  unknownOmenIds: string[];
  target: ItemClassTarget | undefined;
  limits: AffixLimit | undefined;
  baseDomain: string | undefined;
  affixes: IndexedAffix[]; // prefixes then suffixes, stable indexes for reason params
  sideOmen: OmenDefinition | undefined;
  lichOmens: OmenDefinition[];
  putrefaction: OmenDefinition | undefined;
}

export function buildContext(item: ParsedItem, currency: string, activeOmens: readonly string[], data: DataPack): CraftContext {
  const omens = [...new Set(activeOmens)].map((id) => data.omens.find((o) => o.id === id));
  const known = omens.filter((o): o is OmenDefinition => o !== undefined);
  return {
    data,
    item,
    bone: data.bones.find((b) => b.id === currency),
    omens: known,
    unknownOmenIds: [...new Set(activeOmens)].filter((id) => !data.omens.some((o) => o.id === id)),
    target: data.itemClassTargets.find((t) => t.itemClassId === item.itemClassId),
    limits: data.affixLimits.find((l) => l.itemClassId === item.itemClassId && l.rarity === 'rare'),
    baseDomain: resolveBase(item, data)?.domain,
    affixes: [...item.prefixes, ...item.suffixes, ...item.unknownAffixes].map((affix, index) => ({ affix, index })),
    sideOmen: known.find((o) => o.effect.kind === 'force_side'),
    lichOmens: known.filter((o) => o.effect.kind === 'force_lich'),
    putrefaction: known.find((o) => o.effect.kind === 'putrefaction'),
  };
}

/** The base record, or any base of the same class with identical tags when the ID is ambiguous. */
export function resolveBase(item: ParsedItem, data: DataPack): BaseItemDefinition | undefined {
  if (item.baseItemId) return data.baseItems.find((b) => b.id === item.baseItemId);
  const key = [...item.baseTags].sort().join('|');
  return data.baseItems.find((b) => b.itemClassId === item.itemClassId && [...b.tags].sort().join('|') === key);
}

export const hasUsableEvidence = (evidence: RuleEvidence | undefined): boolean =>
  evidence !== undefined && evidence.evidenceRefs.length > 0 && evidence.evidenceLevel !== 'ASSUMPTION_BLOCKED';
