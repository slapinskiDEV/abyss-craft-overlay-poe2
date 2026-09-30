import { describe, expect, it } from 'vitest';
import { buildTierFamilyIds, type TierFamilyInput } from '../../src/data/adapters/tier-family';

const mod = (id: string, overrides: Partial<TierFamilyInput> = {}): TierFamilyInput => ({
  id,
  modTypeId: 'TEST_ONLY_TYPE',
  side: 'prefix',
  sourceKind: 'regular',
  groups: ['TEST_ONLY_GROUP'],
  statIds: ['TEST_ONLY_stat'],
  ...overrides,
});

describe('buildTierFamilyIds (SoT §7.2)', () => {
  it('uses the RePoE type when all members share one shape', () => {
    const ids = buildTierFamilyIds([mod('TEST_ONLY_T1'), mod('TEST_ONLY_T2')]);
    expect(ids.get('TEST_ONLY_T1')).toBe('TEST_ONLY_TYPE');
    expect(ids.get('TEST_ONLY_T2')).toBe('TEST_ONLY_TYPE');
  });

  it('splits a type holding mechanically distinct families, deterministically', () => {
    const inputs = [mod('TEST_ONLY_P'), mod('TEST_ONLY_S', { side: 'suffix' }), mod('TEST_ONLY_X', { sourceKind: 'desecrated_exclusive' })];
    const first = buildTierFamilyIds(inputs);
    const second = buildTierFamilyIds([...inputs].reverse());
    expect(new Set(first.values()).size).toBe(3);
    expect([...first.entries()].sort()).toEqual([...second.entries()].sort());
  });

  it('ignores group/stat ordering', () => {
    const ids = buildTierFamilyIds([
      mod('TEST_ONLY_A', { groups: ['TEST_ONLY_G1', 'TEST_ONLY_G2'] }),
      mod('TEST_ONLY_B', { groups: ['TEST_ONLY_G2', 'TEST_ONLY_G1'] }),
    ]);
    expect(ids.get('TEST_ONLY_A')).toBe(ids.get('TEST_ONLY_B'));
  });
});
