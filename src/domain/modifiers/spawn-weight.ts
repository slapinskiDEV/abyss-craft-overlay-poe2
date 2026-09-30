import type { WeightEntry } from '../../data/normalized/types';

/**
 * Ordered ordinary spawn-weight resolution (SoT §7.3, §7.10): the first entry whose tag is in
 * `effectiveTags` decides, in source order. `null` means no entry matched. Both `null` and `0`
 * mean "not ordinarily spawnable". Entries are never sorted.
 */
export function resolveOrdinarySpawnWeight(
  spawnWeights: readonly WeightEntry[],
  effectiveTags: ReadonlySet<string>,
): number | null {
  for (const entry of spawnWeights) {
    if (effectiveTags.has(entry.tag)) return entry.weight;
  }
  return null;
}

export function isOrdinarilySpawnable(spawnWeights: readonly WeightEntry[], effectiveTags: ReadonlySet<string>): boolean {
  const weight = resolveOrdinarySpawnWeight(spawnWeights, effectiveTags);
  return weight !== null && weight > 0;
}
