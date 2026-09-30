// TEST_ONLY pack for engine tests (SoT §18.1, §18.3 #26). Every entity is role-named. Tag and
// family vocabulary ('ring', 'jawbone', 'breach_desecration' semantics) is rule vocabulary from
// the SoT, not entity data.
import type { BoneDefinition, DataPack, ModifierDefinition, OmenDefinition, RuleEvidence } from '../../../src/data/normalized/types';
import type { ParsedAffix, ParsedItem } from '../../../src/parser/common/types';
import { base, mod, testPack } from './test-only-pack';

const evidence: RuleEvidence = { ruleId: 'TEST_ONLY_RULE', evidenceRefs: ['TEST_ONLY_EVIDENCE'], evidenceLevel: 'VERIFIED_SECONDARY' };

const bone = (id: string, family: BoneDefinition['family'], targetGroup: BoneDefinition['targetGroup'], extra: Partial<BoneDefinition> = {}): BoneDefinition => ({
  id,
  gameMetadataId: `${id}_META`,
  canonicalNameEn: `${id}_NAME`,
  family,
  tier: 'preserved',
  targetGroup,
  unlocksSpecialPools: [],
  releaseState: 'current',
  evidence,
  sourceRefs: ['TEST_ONLY_SOURCE'],
  ...extra,
});
const omen = (id: string, effect: OmenDefinition['effect'], compatibleBoneFamilies: OmenDefinition['compatibleBoneFamilies'] = 'any', phase: OmenDefinition['phase'] = 'desecrate'): OmenDefinition => ({
  id,
  gameMetadataId: `${id}_META`,
  canonicalNameEn: `${id}_NAME`,
  phase,
  effect,
  compatibleBoneFamilies,
  evidence,
  sourceRefs: ['TEST_ONLY_SOURCE'],
});

const ARMOUR = ['TEST_ONLY_tag_armour', 'default'];
const WEAPON = ['TEST_ONLY_tag_weapon', 'default'];
const RING = ['ring', 'TEST_ONLY_tag_jewellery', 'default'];
const on = (tag: string) => [{ tag, weight: 1 }, { tag: 'default', weight: 0 }];

const m = (id: string, o: Partial<ModifierDefinition>) => mod(id, { tierFamilyId: o.tierFamilyId ?? `${id}_FAM`, groups: o.groups ?? [`${id}_GROUP`], ...o });
const exclusive = { domain: 'desecrated', sourceKind: 'desecrated_exclusive' as const };

export const MODS = [
  // armour
  m('TEST_ONLY_MOD_ARMOUR_P1', { side: 'prefix', spawnWeights: on('TEST_ONLY_tag_armour') }),
  m('TEST_ONLY_MOD_ARMOUR_P2', { side: 'prefix', spawnWeights: on('TEST_ONLY_tag_armour') }),
  m('TEST_ONLY_MOD_ARMOUR_P3', { side: 'prefix', spawnWeights: on('TEST_ONLY_tag_armour') }),
  m('TEST_ONLY_MOD_ARMOUR_S1', { side: 'suffix', spawnWeights: on('TEST_ONLY_tag_armour') }),
  m('TEST_ONLY_MOD_ARMOUR_S2', { side: 'suffix', spawnWeights: on('TEST_ONLY_tag_armour') }),
  m('TEST_ONLY_MOD_ARMOUR_S3', { side: 'suffix', spawnWeights: on('TEST_ONLY_tag_armour') }),
  m('TEST_ONLY_MOD_ARMOUR_EXCL_LICH_A_S', { side: 'suffix', ...exclusive, lichPool: 'amanamu', requiredLevel: 65, spawnWeights: on('TEST_ONLY_tag_armour') }),
  // weapon
  m('TEST_ONLY_MOD_WEAPON_P1', { side: 'prefix', spawnWeights: on('TEST_ONLY_tag_weapon') }),
  m('TEST_ONLY_MOD_WEAPON_S1', { side: 'suffix', spawnWeights: on('TEST_ONLY_tag_weapon') }),
  m('TEST_ONLY_MOD_WEAPON_LICH_A_P', { side: 'prefix', ...exclusive, lichPool: 'amanamu', requiredLevel: 65, spawnWeights: on('TEST_ONLY_tag_weapon') }),
  m('TEST_ONLY_MOD_WEAPON_LICH_A_S', { side: 'suffix', ...exclusive, lichPool: 'amanamu', requiredLevel: 65, spawnWeights: on('TEST_ONLY_tag_weapon') }),
  m('TEST_ONLY_MOD_WEAPON_LICH_B_P', { side: 'prefix', ...exclusive, lichPool: 'ulaman', requiredLevel: 65, spawnWeights: on('TEST_ONLY_tag_weapon') }),
  m('TEST_ONLY_MOD_WEAPON_EXCL_P', { side: 'prefix', ...exclusive, spawnWeights: on('TEST_ONLY_tag_weapon') }),
  // jewellery (ring)
  m('TEST_ONLY_MOD_RING_LOW_T1', { side: 'prefix', tierFamilyId: 'TEST_ONLY_FAM_RING_LOW', groups: ['TEST_ONLY_GROUP_RING_LOW'], requiredLevel: 10, spawnWeights: on('TEST_ONLY_tag_jewellery') }),
  m('TEST_ONLY_MOD_RING_LOW_T2', { side: 'prefix', tierFamilyId: 'TEST_ONLY_FAM_RING_LOW', groups: ['TEST_ONLY_GROUP_RING_LOW'], requiredLevel: 30, spawnWeights: on('TEST_ONLY_tag_jewellery') }),
  m('TEST_ONLY_MOD_RING_HIGH_T1', { side: 'prefix', tierFamilyId: 'TEST_ONLY_FAM_RING_HIGH', groups: ['TEST_ONLY_GROUP_RING_HIGH'], requiredLevel: 20, spawnWeights: on('TEST_ONLY_tag_jewellery') }),
  m('TEST_ONLY_MOD_RING_HIGH_T2', { side: 'prefix', tierFamilyId: 'TEST_ONLY_FAM_RING_HIGH', groups: ['TEST_ONLY_GROUP_RING_HIGH'], requiredLevel: 50, spawnWeights: on('TEST_ONLY_tag_jewellery') }),
  m('TEST_ONLY_MOD_RING_S1', { side: 'suffix', spawnWeights: on('TEST_ONLY_tag_jewellery') }),
  m('TEST_ONLY_MOD_RING_LICH_C_S', { side: 'suffix', ...exclusive, lichPool: 'kurgal', requiredLevel: 65, spawnWeights: on('TEST_ONLY_tag_jewellery') }),
  m('TEST_ONLY_MOD_RING_OTHERWORLDLY_S', {
    side: 'suffix',
    ...exclusive,
    specialPools: ['otherworldly'],
    otherworldlyJewelleryClasses: ['ring'],
    spawnWeights: [{ tag: 'ring', weight: 0 }, { tag: 'breach_desecration', weight: 1 }, { tag: 'default', weight: 0 }],
  }),
  // Mark of the Abyssal Lord stand-in (ordinary weight 0)
  m('TEST_ONLY_MOD_MARK_P', { side: 'prefix', spawnWeights: [{ tag: 'default', weight: 0 }] }),
];

export const ENGINE_PACK: DataPack = testPack({
  itemClasses: [
    { id: 'TEST_ONLY_CLASS_ARMOUR', canonicalNameEn: 'TEST_ONLY Armours' },
    { id: 'TEST_ONLY_CLASS_WEAPON', canonicalNameEn: 'TEST_ONLY Weapons' },
    { id: 'TEST_ONLY_CLASS_RING', canonicalNameEn: 'TEST_ONLY Rings' },
    { id: 'TEST_ONLY_CLASS_UNMAPPED', canonicalNameEn: 'TEST_ONLY Unmapped' },
  ],
  bases: [
    base('TEST_ONLY_BASE_ARMOUR', { tags: ARMOUR }),
    base('TEST_ONLY_BASE_WEAPON', { itemClassId: 'TEST_ONLY_CLASS_WEAPON', tags: WEAPON }),
    base('TEST_ONLY_BASE_RING', { itemClassId: 'TEST_ONLY_CLASS_RING', tags: RING }),
    base('TEST_ONLY_BASE_UNMAPPED', { itemClassId: 'TEST_ONLY_CLASS_UNMAPPED', tags: ARMOUR }),
  ],
  modifiers: MODS,
  markIds: ['TEST_ONLY_MOD_MARK_P'],
  extra: {
    bones: [
      bone('TEST_ONLY_BONE_ARMOUR_PLAIN', 'rib', 'armour'),
      bone('TEST_ONLY_BONE_ARMOUR_HIGH', 'rib', 'armour', { tier: 'ancient', minimumModifierLevel: 40 }),
      bone('TEST_ONLY_BONE_WEAPON_PLAIN', 'jawbone', 'weapon_or_quiver'),
      bone('TEST_ONLY_BONE_WEAPON_LOW', 'jawbone', 'weapon_or_quiver', { tier: 'gnawed', maxItemLevel: 64 }),
      bone('TEST_ONLY_BONE_RING_PLAIN', 'collarbone', 'jewellery'),
      bone('TEST_ONLY_BONE_RING_LOW', 'collarbone', 'jewellery', { tier: 'gnawed', maxItemLevel: 64 }),
      bone('TEST_ONLY_BONE_RING_HIGH', 'collarbone', 'jewellery', { tier: 'ancient', minimumModifierLevel: 40 }),
      bone('TEST_ONLY_BONE_RING_OTHERWORLDLY', 'altered_collarbone', 'jewellery', { tier: 'altered', unlocksSpecialPools: ['otherworldly'] }),
      bone('TEST_ONLY_BONE_LEGACY', 'vertebrae', 'waystone', { releaseState: 'drop_disabled_legacy' }),
    ],
    omens: [
      omen('TEST_ONLY_OMEN_FORCE_PREFIX', { kind: 'force_side', side: 'prefix' }),
      omen('TEST_ONLY_OMEN_FORCE_SUFFIX', { kind: 'force_side', side: 'suffix' }),
      omen('TEST_ONLY_OMEN_FORCE_LICH_A', { kind: 'force_lich', lichPool: 'amanamu' }, ['jawbone', 'collarbone']),
      omen('TEST_ONLY_OMEN_FORCE_LICH_B', { kind: 'force_lich', lichPool: 'ulaman' }, ['jawbone', 'collarbone']),
      omen('TEST_ONLY_OMEN_FORCE_LICH_C', { kind: 'force_lich', lichPool: 'kurgal' }, ['jawbone', 'collarbone']),
      omen('TEST_ONLY_OMEN_REPLACE_ALL', { kind: 'putrefaction' }),
      omen('TEST_ONLY_OMEN_REROLL', { kind: 'reveal_reroll', rerolls: 1 }, 'any', 'reveal'),
      omen('TEST_ONLY_OMEN_ANNUL', { kind: 'annul_desecrated_only' }, 'any', 'annul'),
    ],
    otherCurrencies: [{ id: 'TEST_ONLY_CURRENCY_RECOVERY', gameMetadataId: 'TEST_ONLY_META', canonicalNameEn: 'TEST_ONLY_NAME', role: 'recovery', evidence, sourceRefs: ['TEST_ONLY_SOURCE'] }],
    itemClassTargets: [
      { itemClassId: 'TEST_ONLY_CLASS_ARMOUR', target: 'armour', evidence },
      { itemClassId: 'TEST_ONLY_CLASS_WEAPON', target: 'weapon_or_quiver', evidence },
      { itemClassId: 'TEST_ONLY_CLASS_RING', target: 'jewellery', evidence },
    ],
    affixLimits: ['TEST_ONLY_CLASS_ARMOUR', 'TEST_ONLY_CLASS_WEAPON', 'TEST_ONLY_CLASS_RING', 'TEST_ONLY_CLASS_UNMAPPED'].map((itemClassId) => ({ itemClassId, rarity: 'rare' as const, maxPrefixes: 3, maxSuffixes: 3, evidence })),
    mechanicsConstants: { markFloorFactor: { value: 0.4, evidence, uRef: 'U-003' }, revealOptionCount: { value: 3, evidence } },
  },
});

const modsById = new Map(MODS.map((x) => [x.id, x]));

export const affix = (id: string, overrides: Partial<ParsedAffix> = {}): ParsedAffix => {
  const def = modsById.get(id);
  if (!def) throw new Error(`unknown TEST_ONLY mod ${id}`);
  return {
    rawLines: [`${id} line`],
    side: def.side,
    matchedModifierId: id,
    groups: def.groups,
    fractured: false,
    crafted: false,
    desecrated: false,
    candidateModifierIds: [id],
    groupsResolved: true,
    possibleGroups: def.groups,
    addsTagsResolved: true,
    isMarkOfAbyssalLord: id === 'TEST_ONLY_MOD_MARK_P',
    ...overrides,
  };
};

const BASES = { armour: ['TEST_ONLY_BASE_ARMOUR', 'TEST_ONLY_CLASS_ARMOUR', ARMOUR], weapon: ['TEST_ONLY_BASE_WEAPON', 'TEST_ONLY_CLASS_WEAPON', WEAPON], ring: ['TEST_ONLY_BASE_RING', 'TEST_ONLY_CLASS_RING', RING], unmapped: ['TEST_ONLY_BASE_UNMAPPED', 'TEST_ONLY_CLASS_UNMAPPED', ARMOUR] } as const;

/** A fully identified ParsedItem as a confirmed future parser would produce it. */
export function parsed(kind: keyof typeof BASES, affixes: ParsedAffix[], overrides: Partial<ParsedItem> = {}, abyss: Partial<ParsedItem['abyss']> = {}): ParsedItem {
  const [baseItemId, itemClassId, tags] = BASES[kind];
  const mark = affixes.find((a) => a.isMarkOfAbyssalLord);
  return {
    parserLocale: 'en',
    copyMode: 'advanced',
    rawText: '',
    rarity: 'rare',
    baseTypeText: `${baseItemId}_NAME`,
    baseItemId,
    itemClassId,
    itemLevel: 82,
    baseTags: [...tags],
    corrupted: false,
    mirrored: false,
    unidentified: false,
    prefixes: affixes.filter((a) => a.side === 'prefix'),
    suffixes: affixes.filter((a) => a.side === 'suffix'),
    unknownAffixes: affixes.filter((a) => a.side === 'unknown'),
    fracturedState: 'determined',
    isTimeLostJewel: false,
    ...overrides,
    abyss: {
      hasUnrevealedDesecratedModifier: false,
      hasRevealedDesecratedModifier: false,
      hasMarkOfAbyssalLord: mark !== undefined,
      ...(mark && mark.side !== 'unknown' ? { markSide: mark.side } : {}),
      isSpecialMultiDesecrationItem: false,
      existingDesecration: 'absent',
      markState: mark ? 'present' : 'absent',
      ...abyss,
    },
  };
}
