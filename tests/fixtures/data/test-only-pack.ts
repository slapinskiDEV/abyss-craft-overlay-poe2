// TEST_ONLY data pack builder (SoT §0.2 rule 9, §18.1). Role-named synthetic entities only; never
// real IDs or names. Shared by parser (004) and engine (005) tests.
import type {
  BaseItemDefinition,
  DataPack,
  ModifierDefinition,
  StatTranslationEntry,
} from '../../../src/data/normalized/types';

export const mod = (id: string, overrides: Partial<ModifierDefinition> = {}): ModifierDefinition => ({
  id,
  canonicalNameEn: `${id}_NAME`,
  side: 'prefix',
  domain: 'item',
  modTypeId: `${id}_TYPE`,
  requiredLevel: 1,
  groups: [`${id}_GROUP`],
  implicitTags: [],
  addsTags: [],
  spawnWeights: [{ tag: 'TEST_ONLY_tag_armour', weight: 1 }, { tag: 'default', weight: 0 }],
  generationWeights: [],
  stats: [{ id: `${id}_stat`, min: 1, max: 10 }],
  tierFamilyId: `${id}_TYPE`,
  sourceKind: 'regular',
  lichPoolConflict: false,
  specialPools: [],
  otherworldlyJewelleryClasses: [],
  sourceRefs: ['TEST_ONLY_SOURCE'],
  ...overrides,
});

export const base = (id: string, overrides: Partial<BaseItemDefinition> = {}): BaseItemDefinition => ({
  id,
  canonicalNameEn: `${id}_NAME`,
  itemClassId: 'TEST_ONLY_CLASS_ARMOUR',
  tags: ['TEST_ONLY_tag_armour', 'default'],
  domain: 'item',
  releaseState: 'released',
  sourceRefs: ['TEST_ONLY_SOURCE'],
  ...overrides,
});

export const translation = (statIds: string[], template: string, handlers: string[][] = statIds.map(() => [])): StatTranslationEntry => ({
  statIds,
  variants: [{ template, conditions: statIds.map(() => ({})), formats: statIds.map(() => '#'), indexHandlers: handlers }],
});

export interface TestPackInput {
  bases?: BaseItemDefinition[];
  modifiers?: ModifierDefinition[];
  translations?: StatTranslationEntry[];
  itemClasses?: Array<{ id: string; canonicalNameEn: string }>;
  markIds?: string[];
  specialItems?: DataPack['specialItems'];
  extra?: Partial<DataPack>;
}

export function testPack(input: TestPackInput = {}): DataPack {
  const bases = input.bases ?? [];
  const modifiers = input.modifiers ?? [];
  const itemClasses = (input.itemClasses ?? [{ id: 'TEST_ONLY_CLASS_ARMOUR', canonicalNameEn: 'TEST_ONLY Armours' }]).map((c) => ({ ...c, sourceRefs: ['TEST_ONLY_SOURCE'] }));
  const index = (entries: Array<{ id: string; canonicalNameEn: string }>) => {
    const out: Record<string, string[]> = {};
    for (const e of entries) (out[e.canonicalNameEn] ??= []).push(e.id);
    return out;
  };
  return {
    manifest: {
      schemaVersion: 1,
      targetGameVersion: 'TEST_ONLY',
      generatedAt: '1970-01-01T00:00:00.000Z',
      sources: [],
      localizationLocales: ['en'],
      repoeObservedVersion: 'TEST_ONLY',
      dataPackId: 'TEST_ONLY_PACK',
      rulesEvidenceDigest: 'TEST_ONLY',
      stale: false,
      validated: true,
    },
    provenance: {},
    itemClasses,
    baseItems: bases,
    modifiers,
    statTranslationsEn: input.translations ?? [],
    nameIndexEn: {
      baseItemsByName: index(bases),
      itemClassesByName: index(itemClasses),
      modifiersByName: index(modifiers),
    },
    bones: [],
    omens: [],
    otherCurrencies: [],
    itemClassTargets: [],
    affixLimits: [],
    mechanicsConstants: {},
    abyssMarkModifierIds: input.markIds ?? [],
    specialItems: input.specialItems ?? [],
    ...input.extra,
  };
}
