// tierFamilyId construction (SoT §7.2): RePoE `type` when it groups a consistent tier ladder,
// otherwise a deterministic split by stable internal data. Never display text or tier numbers.
import type { AffixSide, ModifierSourceKind } from '../normalized/types';

export interface TierFamilyInput {
  id: string;
  modTypeId: string;
  side: AffixSide;
  sourceKind: ModifierSourceKind;
  groups: readonly string[];
  statIds: readonly string[];
}

const shapeKey = (m: TierFamilyInput): string =>
  [m.side, m.sourceKind, [...m.groups].sort().join('+'), [...m.statIds].sort().join('+')].join('|');

export function buildTierFamilyIds(mods: readonly TierFamilyInput[]): Map<string, string> {
  const byType = new Map<string, TierFamilyInput[]>();
  for (const mod of mods) {
    const members = byType.get(mod.modTypeId);
    if (members) members.push(mod);
    else byType.set(mod.modTypeId, [mod]);
  }

  const result = new Map<string, string>();
  for (const [typeId, members] of byType) {
    const shapes = new Set(members.map(shapeKey));
    for (const member of members) {
      result.set(member.id, shapes.size === 1 ? typeId : `${typeId}#${shapeKey(member)}`);
    }
  }
  return result;
}
