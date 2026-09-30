// RePoE mods.json -> ModifierDefinition[] (spec 002 "Mod selection and classification").
import { isOrdinarilySpawnable } from '../../domain/modifiers/spawn-weight';
import type { LichPool, ModifierDefinition, ModifierSourceKind } from '../normalized/types';
import { classifyLichPool, classifySpecialPools, otherworldlyJewelleryClasses, type LichClassification } from './classify';
import type { RawMod } from './raw-types';
import { buildTierFamilyIds } from './tier-family';

export interface NormalizeModsInput {
  mods: Readonly<Record<string, RawMod>>;
  /** Base domains that ordinary (regular) affixes may come from, e.g. ['item', 'misc']. */
  regularDomains: readonly string[];
  /** Tag sets of the released jewel bases, for jewel-family metadata. */
  jewelBaseTagSets: ReadonlyArray<ReadonlySet<string>>;
  lichOverrides: ReadonlyMap<string, LichPool>;
  /** Provenance record ID of the mods file, e.g. 'repoe:4.5.5.2:mods.min.json'. */
  sourceFileRef: string;
}

export interface LichAuditEntry {
  modifierId: string;
  name: string;
  classification: LichClassification;
}

export interface NormalizeModsResult {
  modifiers: ModifierDefinition[];
  lichAudit: LichAuditEntry[];
  droppedByDomain: Record<string, number>;
}

export function normalizeMods(input: NormalizeModsInput): NormalizeModsResult {
  const regularDomains = new Set(input.regularDomains);
  const droppedByDomain: Record<string, number> = {};
  const selected: Array<[string, RawMod, ModifierSourceKind]> = [];

  for (const id of Object.keys(input.mods).sort()) {
    const mod = input.mods[id];
    if (!mod || (mod.generation_type !== 'prefix' && mod.generation_type !== 'suffix')) continue;
    const sourceKind: ModifierSourceKind | null =
      mod.domain === 'desecrated' ? 'desecrated_exclusive' : regularDomains.has(mod.domain) ? 'regular' : null;
    if (!sourceKind) {
      droppedByDomain[mod.domain] = (droppedByDomain[mod.domain] ?? 0) + 1;
      continue;
    }
    selected.push([id, mod, sourceKind]);
  }

  const families = buildTierFamilyIds(
    selected.map(([id, mod, sourceKind]) => ({
      id,
      modTypeId: mod.type,
      side: mod.generation_type as 'prefix' | 'suffix',
      sourceKind,
      groups: mod.groups,
      statIds: mod.stats.map((s) => s.id),
    })),
  );

  const lichAudit: LichAuditEntry[] = [];
  const modifiers = selected.map(([id, mod, sourceKind]): ModifierDefinition => {
    const lich = classifyLichPool(id, mod, input.lichOverrides);
    if (lich.conflict || lich.basis === 'override') lichAudit.push({ modifierId: id, name: mod.name, classification: lich });
    const jewelApplicable = input.jewelBaseTagSets.some((tags) => isOrdinarilySpawnable(mod.spawn_weights, tags));
    return {
      id,
      canonicalNameEn: mod.name,
      side: mod.generation_type as 'prefix' | 'suffix',
      domain: mod.domain,
      modTypeId: mod.type,
      requiredLevel: mod.required_level,
      groups: [...mod.groups],
      implicitTags: [...mod.implicit_tags],
      addsTags: [...mod.adds_tags],
      spawnWeights: mod.spawn_weights.map(({ tag, weight }) => ({ tag, weight })),
      generationWeights: mod.generation_weights.map(({ tag, weight }) => ({ tag, weight })),
      stats: mod.stats.map(({ id: statId, min, max }) => ({ id: statId, min, max })),
      ...(mod.text !== undefined ? { text: mod.text } : {}),
      tierFamilyId: families.get(id) ?? mod.type,
      sourceKind,
      ...(lich.lichPool ? { lichPool: lich.lichPool } : {}),
      lichPoolConflict: lich.conflict,
      specialPools: classifySpecialPools(mod, jewelApplicable),
      otherworldlyJewelleryClasses: otherworldlyJewelleryClasses(mod),
      sourceRefs: [`${input.sourceFileRef}#${id}`],
    };
  });

  return { modifiers, lichAudit, droppedByDomain };
}
