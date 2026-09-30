// Free affix slots and item-usable Omens (SoT §16.4, 0.2.9).
import { describe, expect, it } from 'vitest';
import { affixSlots, defaultBoneId, defaultSides, evaluateDesecration, usableOmenIds } from '../../src/domain';
import { ENGINE_PACK, affix, parsed } from '../fixtures/data/test-only-engine-pack';

describe('affixSlots', () => {
  it('counts free slots from the evidenced per-class limits', () => {
    const s = affixSlots(parsed('armour', [affix('TEST_ONLY_MOD_ARMOUR_P1'), affix('TEST_ONLY_MOD_ARMOUR_P2'), affix('TEST_ONLY_MOD_ARMOUR_S1')]), ENGINE_PACK);
    expect(s).toMatchObject({ state: 'determined', prefix: { used: 2, max: 3, free: 1 }, suffix: { used: 1, max: 3, free: 2 }, basis: 'complete' });
  });

  it('marks counts as recognized-only while existing Desecration is undetermined (U-011, U-014)', () => {
    const s = affixSlots(parsed('armour', [], {}, { existingDesecration: 'undetermined' }), ENGINE_PACK);
    expect(s).toMatchObject({ state: 'determined', basis: 'recognized_only' });
  });

  it('is undetermined for affixes with an unknown side, non-Rare items and classes without limits', () => {
    const unknownSide = { ...affix('TEST_ONLY_MOD_ARMOUR_P1'), side: 'unknown' as const };
    expect(affixSlots(parsed('armour', [unknownSide]), ENGINE_PACK)).toEqual({ state: 'undetermined', reason: 'AFFIX_SIDE_UNKNOWN' });
    expect(affixSlots(parsed('armour', [], { rarity: 'magic' }), ENGINE_PACK)).toEqual({ state: 'undetermined', reason: 'NOT_RARE' });
    expect(affixSlots(parsed('armour', [], { itemClassId: 'TEST_ONLY_CLASS_NONE' }), ENGINE_PACK)).toEqual({ state: 'undetermined', reason: 'NO_AFFIX_LIMIT' });
  });
});

describe('Unrevealed placeholders take a slot (spec 017 C5)', () => {
  it('counts them as used on their side', () => {
    const item = parsed('armour', [affix('TEST_ONLY_MOD_ARMOUR_P1')], {}, { unrevealedCount: { prefix: 1, suffix: 0 } });
    expect(affixSlots(item, ENGINE_PACK)).toMatchObject({ state: 'determined', prefix: { used: 2, free: 1 }, suffix: { used: 0, free: 3 } });
  });
});

describe('unidentified and mirrored items (SoT U-015, spec 017 C3)', () => {
  const run = (extra: Parameters<typeof parsed>[2]) =>
    evaluateDesecration({ item: parsed('armour', [], extra, { existingDesecration: 'absent' }), parserConfidence: 'full', currency: 'TEST_ONLY_BONE_ARMOUR_PLAIN', activeOmens: [], data: ENGINE_PACK });

  it('does not count free slots on an unidentified item', () => {
    expect(affixSlots(parsed('armour', [], { unidentified: true }), ENGINE_PACK)).toEqual({ state: 'undetermined', reason: 'UNIDENTIFIED' });
  });

  it('makes the exact check unknown, never invalid, and keeps the base pool', () => {
    for (const extra of [{ unidentified: true }, { mirrored: true }]) {
      const e = run(extra);
      expect(e.status).toBe('unknown');
      expect(e.reasons.map((d) => d.code)).toContain('ITEM_STATE_UNDOCUMENTED');
      expect(e.branches.every((b) => b.completeness !== 'final')).toBe(true);
      expect(e.basePool.status).toBe('valid');
    }
    expect(run({}).status).not.toBe('unknown');
  });
});

describe('usableOmenIds', () => {
  it('drops Omens incompatible with the chosen Bone and keeps the others', () => {
    const ids = usableOmenIds(parsed('armour', []), 'TEST_ONLY_BONE_ARMOUR_PLAIN', ENGINE_PACK);
    expect(ids.has('TEST_ONLY_OMEN_FORCE_LICH_A')).toBe(false);
    expect(ids.has('TEST_ONLY_OMEN_FORCE_SUFFIX')).toBe(true);
  });

  it('without a Bone keeps every Omen usable with at least one Bone usable on the item', () => {
    const withBone = usableOmenIds(parsed('armour', []), 'TEST_ONLY_BONE_ARMOUR_PLAIN', ENGINE_PACK);
    const any = usableOmenIds(parsed('armour', []), null, ENGINE_PACK);
    for (const id of withBone) expect(any.has(id)).toBe(true);
  });
});

describe('item defaults (SoT §16.4, 0.2.11)', () => {
  it('defaults to the usable Bone without an item-level limit or modifier-level floor', () => {
    const id = defaultBoneId(parsed('armour', []), ENGINE_PACK);
    const bone = ENGINE_PACK.bones.find((b) => b.id === id);
    expect(bone).toBeDefined();
    expect(bone?.maxItemLevel).toBeUndefined();
    expect(bone?.minimumModifierLevel).toBeUndefined();
  });

  it('filters to the only side with free slots, both sides otherwise', () => {
    const p = (n: number) => Array.from({ length: n }, (_, i) => affix(`TEST_ONLY_MOD_ARMOUR_P${i + 1}`));
    expect(defaultSides(affixSlots(parsed('armour', p(3)), ENGINE_PACK))).toEqual(['suffix']);
    expect(defaultSides(affixSlots(parsed('armour', p(1)), ENGINE_PACK))).toEqual(['prefix', 'suffix']);
    expect(defaultSides({ state: 'undetermined', reason: 'NOT_RARE' })).toEqual(['prefix', 'suffix']);
  });
});
