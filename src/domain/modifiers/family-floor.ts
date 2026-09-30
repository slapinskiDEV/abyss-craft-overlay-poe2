/**
 * Minimum Modifier Level family filter (SoT §10.3, §7.10). Input candidates must already be
 * item-level eligible; this is not the item-level gate.
 */
export interface FloorCandidate {
  id: string;
  tierFamilyId: string;
  requiredLevel: number;
}

export interface FloorResult<T extends FloorCandidate> {
  kept: T[];
  /** Kept only because no tier of its family reached the floor (highest eligible tier). */
  fallbackTierIds: Set<string>;
  removed: T[];
}

export function applyMinimumModifierLevel<T extends FloorCandidate>(candidates: readonly T[], minimum: number): FloorResult<T> {
  const families = new Map<string, T[]>();
  for (const candidate of candidates) {
    const family = families.get(candidate.tierFamilyId);
    if (family) family.push(candidate);
    else families.set(candidate.tierFamilyId, [candidate]);
  }

  const kept: T[] = [];
  const removed: T[] = [];
  const fallbackTierIds = new Set<string>();
  for (const family of families.values()) {
    const atOrAboveFloor = family.filter((c) => c.requiredLevel >= minimum);
    if (atOrAboveFloor.length > 0) {
      kept.push(...atOrAboveFloor);
      removed.push(...family.filter((c) => c.requiredLevel < minimum));
      continue;
    }
    // Deterministic tie-break on id when several tiers share the highest level.
    const highest = [...family].sort((a, b) => b.requiredLevel - a.requiredLevel || a.id.localeCompare(b.id))[0];
    if (highest) {
      kept.push(highest);
      fallbackTierIds.add(highest.id);
      removed.push(...family.filter((c) => c !== highest));
    }
  }
  return { kept, fallbackTierIds, removed };
}
