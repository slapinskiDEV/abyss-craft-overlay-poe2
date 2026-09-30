// Spec 009 / SoT §14.7: the base Desecration pool on the TEST_ONLY pack.
import { describe, expect, it } from 'vitest';
import { evaluateDesecration } from '../../src/domain';
import type { ParsedItem } from '../../src/parser/common/types';
import { ENGINE_PACK as data, affix, parsed } from '../fixtures/data/test-only-engine-pack';

const run = (item: ParsedItem, currency: string, activeOmens: string[] = []) => evaluateDesecration({ item, currency, activeOmens, data, parserConfidence: 'full' });
const ids = (e: ReturnType<typeof run>, side: 'prefix' | 'suffix') => (e.basePool.sides.find((s) => s.side === side)?.eligible ?? []).map((c) => c.modifierId).sort();

// A real clipboard today: markers unconfirmed, so existing Desecration and fractured state are unknown.
const unconfirmed = (item: ParsedItem): ParsedItem => ({ ...item, fracturedState: 'undetermined', abyss: { ...item.abyss, existingDesecration: 'undetermined' } });
const armour = parsed('armour', [affix('TEST_ONLY_MOD_ARMOUR_P1'), affix('TEST_ONLY_MOD_ARMOUR_S1')]);

describe('base Desecration pool (spec 009)', () => {
  it('lists both sides when the exact check is unknown because of undetermined item state', () => {
    const e = run(unconfirmed(armour), 'TEST_ONLY_BONE_ARMOUR_PLAIN');
    expect(e.status).toBe('unknown');
    expect(e.branches).toEqual([]);
    expect(e.basePool.status).toBe('valid');
    expect(e.basePool.sides.map((s) => `${s.kind}:${s.side}:${s.completeness}`)).toEqual(['base:prefix:base_eligibility_only', 'base:suffix:base_eligibility_only']);
    expect(e.basePool.sides.every((s) => s.completenessReasons.some((r) => r.code === 'BASE_POOL_ONLY'))).toBe(true);
    // Current modifiers are not considered: P1 and S1 stay listed.
    expect(ids(e, 'prefix')).toEqual(['TEST_ONLY_MOD_ARMOUR_P1', 'TEST_ONLY_MOD_ARMOUR_P2', 'TEST_ONLY_MOD_ARMOUR_P3']);
    expect(ids(e, 'suffix')).toContain('TEST_ONLY_MOD_ARMOUR_S1');
  });

  it('is never final', () => {
    const e = run(armour, 'TEST_ONLY_BONE_ARMOUR_PLAIN');
    expect(e.poolCompleteness).toBe('final');
    expect(e.basePool.sides.some((s) => s.completeness === 'final')).toBe(false);
  });

  it('is not affected by a full side, a Mark or unresolved affixes', () => {
    const full = parsed('armour', ['P1', 'P2', 'P3'].map((s) => affix(`TEST_ONLY_MOD_ARMOUR_${s}`)));
    expect(run(full, 'TEST_ONLY_BONE_ARMOUR_PLAIN').status).toBe('unknown'); // U-012
    expect(run(full, 'TEST_ONLY_BONE_ARMOUR_PLAIN').basePool.sides).toHaveLength(2);
    const marked = parsed('armour', [affix('TEST_ONLY_MOD_MARK_P')], {}, { markState: 'undetermined' });
    expect(run(marked, 'TEST_ONLY_BONE_ARMOUR_PLAIN').basePool.status).toBe('valid');
  });

  it('restricts the side with a side Omen', () => {
    const e = run(unconfirmed(armour), 'TEST_ONLY_BONE_ARMOUR_PLAIN', ['TEST_ONLY_OMEN_FORCE_SUFFIX']);
    expect(e.basePool.sides.map((s) => s.side)).toEqual(['suffix']);
  });

  it('shows no base pool for evidenced invalid crafts', () => {
    for (const item of [{ ...armour, corrupted: true }, { ...armour, rarity: 'magic' as const }, parsed('armour', [affix('TEST_ONLY_MOD_ARMOUR_P1')], {}, { existingDesecration: 'present' })]) {
      const e = run(item, 'TEST_ONLY_BONE_ARMOUR_PLAIN');
      expect(e.basePool.status).toBe('invalid');
      expect(e.basePool.sides).toEqual([]);
    }
    const lich = run(unconfirmed(armour), 'TEST_ONLY_BONE_ARMOUR_PLAIN', ['TEST_ONLY_OMEN_FORCE_LICH_A']);
    expect(lich.basePool.reasons.map((r) => r.code)).toContain('LICH_OMEN_INCOMPATIBLE_WITH_BONE');
    expect(lich.basePool.sides).toEqual([]);
    expect(run(unconfirmed(armour), 'TEST_ONLY_BONE_WEAPON_PLAIN').basePool.sides).toEqual([]);
  });

  it('keeps combination U-items blocking (U-002 Altered Collarbone + Putrefaction)', () => {
    const ring = parsed('ring', [affix('TEST_ONLY_MOD_RING_S1')]);
    const e = run(ring, 'TEST_ONLY_BONE_RING_OTHERWORLDLY', ['TEST_ONLY_OMEN_REPLACE_ALL']);
    expect(e.basePool.status).toBe('unknown');
    expect(e.basePool.sides).toEqual([]);
  });

  it('applies the Ancient floor, never the Mark floor', () => {
    const ring = parsed('ring', [affix('TEST_ONLY_MOD_RING_S1')], { itemLevel: 82 });
    const e = run(unconfirmed(ring), 'TEST_ONLY_BONE_RING_HIGH');
    const prefix = e.basePool.sides.find((s) => s.side === 'prefix');
    expect(prefix?.blocked.filter((c) => c.reasons.some((r) => r.code === 'BELOW_MINIMUM_MODIFIER_LEVEL')).map((c) => c.modifierId)).toContain('TEST_ONLY_MOD_RING_HIGH_T1');
    const marked = parsed('armour', [affix('TEST_ONLY_MOD_MARK_P')], { itemLevel: 82 });
    const plain = run(marked, 'TEST_ONLY_BONE_ARMOUR_PLAIN').basePool.sides.flatMap((s) => s.blocked);
    expect(plain.some((c) => c.reasons.some((r) => r.code === 'BELOW_MINIMUM_MODIFIER_LEVEL'))).toBe(false);
  });

  it('applies U-013 unchanged: empty forced Lich pool with a floor gives an unknown side', () => {
    const ring = parsed('ring', [affix('TEST_ONLY_MOD_RING_S1')], { itemLevel: 64 });
    const e = run(unconfirmed(ring), 'TEST_ONLY_BONE_RING_HIGH', ['TEST_ONLY_OMEN_FORCE_LICH_C']);
    expect(e.basePool.reasons.map((r) => r.code)).toContain('FORCED_LICH_POOL_EMPTY');
    expect(e.basePool.sides.map((s) => s.completeness)).toEqual(['unknown', 'unknown']);
    expect(e.basePool.sides.flatMap((s) => s.eligible)).toEqual([]);
  });

  it('uses regular sources only under Putrefaction', () => {
    const e = run(unconfirmed(armour), 'TEST_ONLY_BONE_ARMOUR_PLAIN', ['TEST_ONLY_OMEN_REPLACE_ALL']);
    expect(e.basePool.reasons.map((r) => r.code)).toContain('ITEM_WILL_BE_CORRUPTED');
    expect(e.basePool.sides.flatMap((s) => s.eligible).every((c) => c.sourceKind === 'regular')).toBe(true);
  });

  it('is deterministic', () => {
    expect(run(unconfirmed(armour), 'TEST_ONLY_BONE_ARMOUR_PLAIN')).toEqual(run(unconfirmed(armour), 'TEST_ONLY_BONE_ARMOUR_PLAIN'));
  });
});
