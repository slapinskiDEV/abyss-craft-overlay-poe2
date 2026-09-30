// Normalized data-pack model (SoT §0.3, §7.1, §7.2; spec 002).

export type EvidenceLevel = 'VERIFIED_PRIMARY' | 'VERIFIED_SECONDARY' | 'MANUAL_CONFIRMED' | 'ASSUMPTION_BLOCKED';

export interface ProvenanceRecord {
  id: string;
  sourceName: string;
  sourceUrl?: string;
  observedVersion?: string;
  retrievedAt?: string;
  sha256?: string;
  sourceRecordId?: string;
  evidenceLevel: EvidenceLevel;
  notes?: string;
}

export interface RuleEvidence {
  ruleId: string;
  evidenceRefs: string[];
  evidenceLevel: EvidenceLevel;
  notes?: string;
}

export type AffixSide = 'prefix' | 'suffix';
export type ModifierSourceKind = 'regular' | 'desecrated_exclusive';
export type LichPool = 'amanamu' | 'ulaman' | 'kurgal';
export type SpecialPool = 'otherworldly' | 'jewel_lightless' | 'jewel_of_the_abyss';
export type JewelleryClassTag = 'amulet' | 'ring' | 'belt';

export interface WeightEntry {
  tag: string;
  weight: number;
}

export interface BaseItemDefinition {
  id: string;
  canonicalNameEn: string;
  itemClassId: string;
  tags: string[];
  domain: string;
  releaseState: string;
  sourceRefs: string[];
}

export interface ModifierDefinition {
  id: string;
  canonicalNameEn: string;
  side: AffixSide;
  domain: string;
  modTypeId: string;
  requiredLevel: number;
  groups: string[];
  implicitTags: string[];
  addsTags: string[];
  spawnWeights: WeightEntry[];
  generationWeights: WeightEntry[];
  stats: Array<{ id: string; min: number; max: number }>;
  text?: string;
  tierFamilyId: string;
  sourceKind: ModifierSourceKind;
  lichPool?: LichPool;
  lichPoolConflict: boolean;
  specialPools: SpecialPool[];
  otherworldlyJewelleryClasses: JewelleryClassTag[];
  sourceRefs: string[];
}

// ---- Data pack (spec 002 "Normalized types") ----

export type BoneFamily = 'jawbone' | 'rib' | 'collarbone' | 'altered_collarbone' | 'cranium' | 'vertebrae';
export type BoneTargetGroup = 'weapon_or_quiver' | 'armour' | 'jewellery' | 'jewel' | 'waystone';

export interface BoneDefinition {
  id: string;
  gameMetadataId: string;
  canonicalNameEn: string;
  family: BoneFamily;
  tier: 'gnawed' | 'preserved' | 'ancient' | 'altered';
  targetGroup: BoneTargetGroup;
  maxItemLevel?: number;
  minimumModifierLevel?: number;
  unlocksSpecialPools: SpecialPool[];
  releaseState: 'current' | 'drop_disabled_legacy';
  evidence: RuleEvidence;
  sourceRefs: string[];
}

export type OmenEffect =
  | { kind: 'force_side'; side: AffixSide }
  | { kind: 'force_lich'; lichPool: LichPool }
  | { kind: 'putrefaction' }
  | { kind: 'reveal_reroll'; rerolls: number }
  | { kind: 'annul_desecrated_only' };

export interface OmenDefinition {
  id: string;
  gameMetadataId: string;
  canonicalNameEn: string;
  phase: 'desecrate' | 'reveal' | 'annul';
  effect: OmenEffect;
  compatibleBoneFamilies: BoneFamily[] | 'any';
  evidence: RuleEvidence;
  sourceRefs: string[];
}

export interface OtherCurrencyDefinition {
  id: string;
  gameMetadataId: string;
  canonicalNameEn: string;
  role: 'recovery';
  evidence: RuleEvidence;
  sourceRefs: string[];
}

export interface ItemClassDefinition { id: string; canonicalNameEn: string; sourceRefs: string[] }
export interface ItemClassTarget { itemClassId: string; target: BoneTargetGroup; evidence: RuleEvidence }
export interface AffixLimit { itemClassId: string; rarity: 'rare'; maxPrefixes: number; maxSuffixes: number; evidence: RuleEvidence }
export interface MechanicsConstant { value: number; evidence: RuleEvidence; uRef?: string }

export interface SpecialItemDefinition {
  handling: 'unsupported_special_item' | 'special_jewel_rule';
  baseItemIds: string[];
  uniqueNamesEn: string[];
  evidence: RuleEvidence;
}

export interface StatTranslationEntry {
  statIds: string[];
  variants: Array<{
    template: string;
    conditions: Array<{ min?: number; max?: number; negated?: boolean }>;
    formats: string[];
    /** Per stat index, RePoE value handlers applied for display (e.g. 'negate'). */
    indexHandlers: string[][];
  }>;
}

export interface EntityNameIndex {
  baseItemsByName: Record<string, string[]>;
  itemClassesByName: Record<string, string[]>;
  modifiersByName: Record<string, string[]>;
}

export interface DataManifest {
  schemaVersion: number;
  targetGameVersion: string;
  generatedAt: string;
  sources: Array<{ name: string; url: string; observedVersion?: string; sha256?: string }>;
  localizationLocales: string[];
  repoeObservedVersion: string;
  dataPackId: string;
  rulesEvidenceDigest: string;
  stale: boolean;
  validated: boolean;
}

export interface DataPackContent {
  provenance: Record<string, ProvenanceRecord>;
  itemClasses: ItemClassDefinition[];
  baseItems: BaseItemDefinition[];
  modifiers: ModifierDefinition[];
  statTranslationsEn: StatTranslationEntry[];
  nameIndexEn: EntityNameIndex;
  bones: BoneDefinition[];
  omens: OmenDefinition[];
  otherCurrencies: OtherCurrencyDefinition[];
  itemClassTargets: ItemClassTarget[];
  affixLimits: AffixLimit[];
  mechanicsConstants: Record<string, MechanicsConstant>;
  abyssMarkModifierIds: string[];
  specialItems: SpecialItemDefinition[];
}

export interface DataPack extends DataPackContent {
  manifest: DataManifest;
}

export const DATA_PACK_SCHEMA_VERSION = 1;
