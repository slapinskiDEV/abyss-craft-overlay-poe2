// Build-time classification (SoT §7.4–7.7, §7.10). Pure functions over raw RePoE rows.
import type { JewelleryClassTag, LichPool, SpecialPool } from '../normalized/types';
import type { RawMod } from './raw-types';

const LICH_NAME_PATTERNS: ReadonlyArray<readonly [LichPool, readonly string[]]> = [
  ['amanamu', ["Amanamu's", 'of Amanamu']],
  ['ulaman', ["Ulaman's", 'of Ulaman']],
  ['kurgal', ["Kurgal's", 'of Kurgal']],
];

const LICH_TAGS: Readonly<Record<string, LichPool>> = {
  amanamu_mod: 'amanamu',
  ulaman_mod: 'ulaman',
  kurgal_mod: 'kurgal',
};

const OTHERWORLDLY_GATE_TAG = 'breach_desecration';
const JEWELLERY_CLASS_TAGS: ReadonlySet<string> = new Set<JewelleryClassTag>(['amulet', 'ring', 'belt']);

/** Lich tags observed on a row: implicit tags plus positive spawn-weight tags. */
export function observedLichTags(mod: RawMod): LichPool[] {
  const tags = [...mod.implicit_tags, ...mod.spawn_weights.filter((w) => w.weight > 0).map((w) => w.tag)];
  const pools = new Set<LichPool>();
  for (const tag of tags) {
    const pool = LICH_TAGS[tag];
    if (pool) pools.add(pool);
  }
  return [...pools].sort();
}

export interface LichClassification {
  lichPool?: LichPool;
  /** Tags contradict the classification and no curated override covers the row (SoT §7.5 rule 4). */
  conflict: boolean;
  basis: 'override' | 'name' | 'none';
  observedTags: LichPool[];
}

/** SoT §7.5 precedence: curated override -> canonical EN name pattern -> none; tags only audit. */
export function classifyLichPool(
  modId: string,
  mod: RawMod,
  overrides: ReadonlyMap<string, LichPool>,
): LichClassification {
  const observedTags = observedLichTags(mod);
  if (mod.domain !== 'desecrated') {
    return { conflict: observedTags.length > 0, basis: 'none', observedTags };
  }
  const override = overrides.get(modId);
  if (override) return { lichPool: override, conflict: false, basis: 'override', observedTags };

  const byName = LICH_NAME_PATTERNS.find(([, names]) => names.includes(mod.name))?.[0];
  const tagsAgree = byName ? observedTags.length === 1 && observedTags[0] === byName : observedTags.length === 0;
  return byName
    ? { lichPool: byName, conflict: !tagsAgree, basis: 'name', observedTags }
    : { conflict: !tagsAgree, basis: 'none', observedTags };
}

/** SoT §7.6 rules 1–2. */
export function isOtherworldly(mod: RawMod): boolean {
  return mod.domain === 'desecrated' && mod.spawn_weights.some((w) => w.tag === OTHERWORLDLY_GATE_TAG && w.weight > 0);
}

/** SoT §7.6 rule 4: explicit jewellery tags regardless of their (usually zero) ordinary weight. */
export function otherworldlyJewelleryClasses(mod: RawMod): JewelleryClassTag[] {
  if (!isOtherworldly(mod)) return [];
  const classes = new Set<JewelleryClassTag>();
  for (const { tag } of mod.spawn_weights) {
    if (JEWELLERY_CLASS_TAGS.has(tag)) classes.add(tag as JewelleryClassTag);
  }
  return [...classes].sort();
}

/**
 * SoT §7.6–7.7. Jewel families are display metadata for desecrated rows that are spawnable on at
 * least one jewel base (`jewelApplicable`); they are never Lich pools.
 */
export function classifySpecialPools(mod: RawMod, jewelApplicable: boolean): SpecialPool[] {
  const pools: SpecialPool[] = [];
  if (isOtherworldly(mod)) pools.push('otherworldly');
  if (mod.domain === 'desecrated' && jewelApplicable) {
    if (mod.name === 'Lightless') pools.push('jewel_lightless');
    if (mod.name === 'of the Abyss') pools.push('jewel_of_the_abyss');
  }
  return pools;
}
