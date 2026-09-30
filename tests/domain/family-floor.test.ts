import { describe, expect, it } from 'vitest';
import { applyMinimumModifierLevel } from '../../src/domain/modifiers/family-floor';

const tier = (id: string, family: string, requiredLevel: number) => ({ id, tierFamilyId: family, requiredLevel });

describe('applyMinimumModifierLevel (SoT §10.3, §7.10)', () => {
  it('keeps only tiers at or above the floor when any exist', () => {
    const result = applyMinimumModifierLevel(
      [tier('TEST_ONLY_A1', 'TEST_ONLY_FAM_A', 20), tier('TEST_ONLY_A2', 'TEST_ONLY_FAM_A', 40), tier('TEST_ONLY_A3', 'TEST_ONLY_FAM_A', 60)],
      40,
    );
    expect(result.kept.map((t) => t.id).sort()).toEqual(['TEST_ONLY_A2', 'TEST_ONLY_A3']);
    expect(result.removed.map((t) => t.id)).toEqual(['TEST_ONLY_A1']);
    expect(result.fallbackTierIds.size).toBe(0);
  });

  it('keeps the highest tier when the whole family is below the floor (SoT §18.3 #17)', () => {
    const result = applyMinimumModifierLevel([tier('TEST_ONLY_B1', 'TEST_ONLY_FAM_B', 10), tier('TEST_ONLY_B2', 'TEST_ONLY_FAM_B', 30)], 40);
    expect(result.kept.map((t) => t.id)).toEqual(['TEST_ONLY_B2']);
    expect([...result.fallbackTierIds]).toEqual(['TEST_ONLY_B2']);
    expect(result.removed.map((t) => t.id)).toEqual(['TEST_ONLY_B1']);
  });

  it('handles families independently', () => {
    const result = applyMinimumModifierLevel([tier('TEST_ONLY_A1', 'TEST_ONLY_FAM_A', 50), tier('TEST_ONLY_B1', 'TEST_ONLY_FAM_B', 5)], 40);
    expect(result.kept.map((t) => t.id).sort()).toEqual(['TEST_ONLY_A1', 'TEST_ONLY_B1']);
  });

  it('returns nothing for no candidates', () => {
    expect(applyMinimumModifierLevel([], 40).kept).toEqual([]);
  });
});

describe('stage order equivalence (spec 005 design choice)', () => {
  // Tiers of one family share groups, so blocking by group removes whole families and commutes
  // with the family floor.
  const families = ['TEST_ONLY_FAM_A', 'TEST_ONLY_FAM_B', 'TEST_ONLY_FAM_C'];
  const pool = families.flatMap((f, i) => [5, 25, 45, 65].map((lvl) => ({ id: `${f}_${lvl}`, tierFamilyId: f, requiredLevel: lvl + i, group: `${f}_GROUP` })));
  const block = <T extends { group: string }>(xs: T[], groups: Set<string>) => xs.filter((x) => !groups.has(x.group));
  const ids = (xs: Array<{ id: string }>) => xs.map((x) => x.id).sort();

  it.each([
    [new Set<string>(), 40],
    [new Set(['TEST_ONLY_FAM_B_GROUP']), 40],
    [new Set(['TEST_ONLY_FAM_A_GROUP', 'TEST_ONLY_FAM_C_GROUP']), 70],
  ])('blocked groups %o, floor %i', (groups, floor) => {
    const floorThenBlock = block(applyMinimumModifierLevel(pool, floor).kept, groups);
    const blockThenFloor = applyMinimumModifierLevel(block(pool, groups), floor).kept;
    expect(ids(floorThenBlock)).toEqual(ids(blockThenFloor));
  });
});
