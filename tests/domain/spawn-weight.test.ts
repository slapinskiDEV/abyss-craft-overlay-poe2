import { describe, expect, it } from 'vitest';
import { isOrdinarilySpawnable, resolveOrdinarySpawnWeight } from '../../src/domain/modifiers/spawn-weight';

const weights = [
  { tag: 'TEST_ONLY_tag_specific', weight: 0 },
  { tag: 'TEST_ONLY_tag_broad', weight: 5 },
  { tag: 'default', weight: 0 },
];

describe('resolveOrdinarySpawnWeight (SoT §7.10)', () => {
  it('uses the first matching entry in source order', () => {
    expect(resolveOrdinarySpawnWeight(weights, new Set(['TEST_ONLY_tag_broad', 'TEST_ONLY_tag_specific']))).toBe(0);
    expect(resolveOrdinarySpawnWeight(weights, new Set(['TEST_ONLY_tag_broad', 'default']))).toBe(5);
  });

  it('returns null when nothing matches', () => {
    expect(resolveOrdinarySpawnWeight(weights, new Set(['TEST_ONLY_tag_other']))).toBeNull();
  });

  it('treats null and zero as not spawnable', () => {
    expect(isOrdinarilySpawnable(weights, new Set(['TEST_ONLY_tag_other']))).toBe(false);
    expect(isOrdinarilySpawnable(weights, new Set(['default']))).toBe(false);
    expect(isOrdinarilySpawnable(weights, new Set(['TEST_ONLY_tag_broad']))).toBe(true);
  });
});
