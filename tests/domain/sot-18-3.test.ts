// SoT §18.3 mandatory rules-engine cases on the TEST_ONLY pack. Case titles keep the SoT wording;
// the entities are role-named stand-ins (e.g. "Preserved Rib" -> TEST_ONLY_BONE_ARMOUR_PLAIN).
import { describe, expect, it } from 'vitest';
import { evaluateDesecration, type DesecrationEvaluation } from '../../src/domain';
import type { ParsedItem, ParserConfidence } from '../../src/parser/common/types';
import { ENGINE_PACK as data, affix, parsed } from '../fixtures/data/test-only-engine-pack';

const run = (item: ParsedItem, currency: string, activeOmens: string[] = [], parserConfidence: ParserConfidence = 'full') =>
  evaluateDesecration({ item, currency, activeOmens, data, parserConfidence });
const codes = (e: DesecrationEvaluation) => e.reasons.map((r) => r.code);
const eligibleIds = (e: DesecrationEvaluation, branch = 0) => (e.branches[branch]?.eligible ?? []).map((c) => c.modifierId).sort();
const blockedReasons = (e: DesecrationEvaluation, id: string) => e.branches.flatMap((b) => b.blocked.filter((c) => c.modifierId === id).flatMap((c) => c.reasons.map((r) => r.code)));

const armour = parsed('armour', [affix('TEST_ONLY_MOD_ARMOUR_P1'), affix('TEST_ONLY_MOD_ARMOUR_S1')]);
const bow82 = parsed('weapon', [affix('TEST_ONLY_MOD_WEAPON_P1')]);
const ring = (itemLevel: number) => parsed('ring', [affix('TEST_ONLY_MOD_RING_S1')], { itemLevel });

describe('SoT §18.3 rules-engine cases', () => {
  it('SoT 18.3 #1 Rare Ornate Plate + Preserved Rib -> valid', () => {
    const e = run(armour, 'TEST_ONLY_BONE_ARMOUR_PLAIN');
    expect(e.status).toBe('valid');
    expect(e.branches.map((b) => `${b.kind}:${b.side}`)).toEqual(['open_slot:prefix', 'open_slot:suffix']);
    expect(e.poolCompleteness).toBe('final');
  });

  it('SoT 18.3 #2 Ornate Plate + Preserved Rib + Omen of the Liege -> invalid compatibility', () => {
    const e = run(armour, 'TEST_ONLY_BONE_ARMOUR_PLAIN', ['TEST_ONLY_OMEN_FORCE_LICH_A']);
    expect(e.status).toBe('invalid');
    expect(codes(e)).toContain('LICH_OMEN_INCOMPATIBLE_WITH_BONE');
    expect(e.branches).toEqual([]);
  });

  it('SoT 18.3 #3 Ornate Plate + Preserved Rib + Dextral -> suffix branch only', () => {
    const e = run(armour, 'TEST_ONLY_BONE_ARMOUR_PLAIN', ['TEST_ONLY_OMEN_FORCE_SUFFIX']);
    expect(e.branches.map((b) => b.side)).toEqual(['suffix']);
  });

  it('SoT 18.3 #4 open prefix, full suffix + Dextral -> suffix replacement branches, not prefix', () => {
    const item = parsed('armour', [affix('TEST_ONLY_MOD_ARMOUR_P1'), affix('TEST_ONLY_MOD_ARMOUR_S1'), affix('TEST_ONLY_MOD_ARMOUR_S2'), affix('TEST_ONLY_MOD_ARMOUR_S3')]);
    const e = run(item, 'TEST_ONLY_BONE_ARMOUR_PLAIN', ['TEST_ONLY_OMEN_FORCE_SUFFIX']);
    expect(e.branches.map((b) => `${b.kind}:${b.side}`)).toEqual(['removal:suffix', 'removal:suffix', 'removal:suffix']);
  });

  it('SoT 18.3 #5 Bow ilvl 82 + Preserved Jawbone + Liege + Sinistral -> Amanamu prefix pool', () => {
    const e = run(bow82, 'TEST_ONLY_BONE_WEAPON_PLAIN', ['TEST_ONLY_OMEN_FORCE_LICH_A', 'TEST_ONLY_OMEN_FORCE_PREFIX']);
    expect(e.status).toBe('valid');
    expect(eligibleIds(e)).toEqual(['TEST_ONLY_MOD_WEAPON_LICH_A_P']);
    expect(blockedReasons(e, 'TEST_ONLY_MOD_WEAPON_LICH_B_P')).toContain('OTHER_LICH_BLOCKED_BY_FORCE_OMEN');
    expect(blockedReasons(e, 'TEST_ONLY_MOD_WEAPON_EXCL_P')).toContain('LICH_SOURCE_NOT_SELECTED');
  });

  it('SoT 18.3 #6 Bow ilvl 82 + Preserved Jawbone + Liege + Dextral -> Amanamu suffix pool', () => {
    const e = run(bow82, 'TEST_ONLY_BONE_WEAPON_PLAIN', ['TEST_ONLY_OMEN_FORCE_LICH_A', 'TEST_ONLY_OMEN_FORCE_SUFFIX']);
    expect(eligibleIds(e)).toEqual(['TEST_ONLY_MOD_WEAPON_LICH_A_S']);
  });

  it('SoT 18.3 #7 Weapon ilvl 64 + Gnawed Jawbone + Liege -> valid with warning, forced pool empty', () => {
    const e = run(parsed('weapon', [affix('TEST_ONLY_MOD_WEAPON_P1')], { itemLevel: 64 }), 'TEST_ONLY_BONE_WEAPON_LOW', ['TEST_ONLY_OMEN_FORCE_LICH_A', 'TEST_ONLY_OMEN_FORCE_PREFIX']);
    expect(e.status).toBe('valid_with_warning');
    expect(codes(e)).toContain('FORCED_LICH_POOL_EMPTY');
    // A non-Lich exclusive prefix survives, so the fallback composition is unverified (U-013).
    expect(e.branches[0]?.completeness).toBe('unknown');
    expect(e.branches[0]?.eligible).toEqual([]);
  });

  it('SoT 18.3 #8 Jewellery ilvl 64 + Gnawed Collarbone + Sovereign -> valid with warning, forced pool empty', () => {
    const item = parsed('ring', [affix('TEST_ONLY_MOD_RING_LOW_T1')], { itemLevel: 64 });
    const e = run(item, 'TEST_ONLY_BONE_RING_LOW', ['TEST_ONLY_OMEN_FORCE_LICH_B', 'TEST_ONLY_OMEN_FORCE_SUFFIX']);
    expect(e.status).toBe('valid_with_warning');
    expect(codes(e)).toContain('FORCED_LICH_POOL_EMPTY');
    // No floor and no non-forced exclusive survives: the documented regular fallback is final.
    expect(e.branches[0]?.completeness).toBe('final');
    expect(eligibleIds(e)).toEqual(['TEST_ONLY_MOD_RING_S1']);
    expect(blockedReasons(e, 'TEST_ONLY_MOD_RING_LICH_C_S')).toContain('ITEM_LEVEL_TOO_LOW');
  });

  it('SoT 18.3 #9 Jewellery + Ancient Collarbone + Blackblooded -> Ancient benefit overridden warning', () => {
    const e = run(ring(80), 'TEST_ONLY_BONE_RING_HIGH', ['TEST_ONLY_OMEN_FORCE_LICH_C', 'TEST_ONLY_OMEN_FORCE_SUFFIX']);
    expect(e.status).toBe('valid_with_warning');
    expect(codes(e)).toContain('ANCIENT_BENEFIT_OVERRIDDEN_BY_LICH_OMEN');
    expect(eligibleIds(e)).toEqual(['TEST_ONLY_MOD_RING_LICH_C_S']);
  });

  it('SoT 18.3 #10 Jewellery + Altered Collarbone + Lich force Omen -> invalid', () => {
    const e = run(ring(80), 'TEST_ONLY_BONE_RING_OTHERWORLDLY', ['TEST_ONLY_OMEN_FORCE_LICH_A']);
    expect(e.status).toBe('invalid');
    expect(codes(e)).toContain('ALTERED_COLLARBONE_LICH_OMEN_CONFLICT');
  });

  it('SoT 18.3 #11 Jewellery + Altered Collarbone + Dextral -> ordinary + Otherworldly suffix pool', () => {
    const e = run(ring(80), 'TEST_ONLY_BONE_RING_OTHERWORLDLY', ['TEST_ONLY_OMEN_FORCE_SUFFIX']);
    expect(eligibleIds(e)).toEqual(expect.arrayContaining(['TEST_ONLY_MOD_RING_OTHERWORLDLY_S', 'TEST_ONLY_MOD_RING_LICH_C_S']));
    expect(e.branches[0]?.poolSummary.otherworldly).toBe(1);
    const ordinary = run(ring(80), 'TEST_ONLY_BONE_RING_PLAIN', ['TEST_ONLY_OMEN_FORCE_SUFFIX']);
    expect(blockedReasons(ordinary, 'TEST_ONLY_MOD_RING_OTHERWORLDLY_S')).toEqual(['SOURCE_NOT_ENABLED']);
  });

  it('SoT 18.3 #12 Existing Desecrated item + ordinary Bone -> invalid', () => {
    const e = run(parsed('armour', [], {}, { existingDesecration: 'present', hasRevealedDesecratedModifier: true }), 'TEST_ONLY_BONE_ARMOUR_PLAIN');
    expect(e.status).toBe('invalid');
    expect(codes(e)).toContain('ITEM_ALREADY_DESECRATED');
  });

  it('SoT 18.3 #13 Corrupted rare + Bone -> invalid', () => {
    expect(run(parsed('armour', [], { corrupted: true }), 'TEST_ONLY_BONE_ARMOUR_PLAIN').status).toBe('invalid');
  });

  it('SoT 18.3 #14 Non-rare ordinary item + Bone -> invalid', () => {
    const e = run(parsed('armour', [], { rarity: 'magic' }), 'TEST_ONLY_BONE_ARMOUR_PLAIN');
    expect(e.status).toBe('invalid');
    expect(codes(e)).toContain('ITEM_NOT_RARE');
  });

  it('SoT 18.3 #15 existing group blocker -> candidate Blocked with MOD_GROUP_CONFLICT', () => {
    const e = run(armour, 'TEST_ONLY_BONE_ARMOUR_PLAIN', ['TEST_ONLY_OMEN_FORCE_SUFFIX']);
    const blocked = e.branches[0]?.blocked.find((c) => c.modifierId === 'TEST_ONLY_MOD_ARMOUR_S1');
    expect(blocked?.reasons).toContainEqual({ code: 'MOD_GROUP_CONFLICT', params: { affixIndex: 1, modifierId: 'TEST_ONLY_MOD_ARMOUR_S1' } });
  });

  it('SoT 18.3 #16 Full affix side with multiple removable mods -> multiple branches', () => {
    const full = parsed('armour', ['P1', 'P2', 'P3', 'S1', 'S2', 'S3'].map((s) => affix(`TEST_ONLY_MOD_ARMOUR_${s}`)));
    const e = run(full, 'TEST_ONLY_BONE_ARMOUR_PLAIN');
    expect(e.branches).toHaveLength(6);
    // each removal branch unblocks the removed affix's own group
    const removedP1 = e.branches.find((b) => b.removedAffixId === 'TEST_ONLY_MOD_ARMOUR_P1');
    expect(removedP1?.eligible.map((c) => c.modifierId)).toContain('TEST_ONLY_MOD_ARMOUR_P1');
  });

  it('SoT 18.3 #17 Ancient Bone retains highest below-40 tier of a family', () => {
    const e = run(ring(80), 'TEST_ONLY_BONE_RING_HIGH', ['TEST_ONLY_OMEN_FORCE_PREFIX']);
    const ids = eligibleIds(e);
    expect(ids).toContain('TEST_ONLY_MOD_RING_LOW_T2');
    expect(ids).not.toContain('TEST_ONLY_MOD_RING_LOW_T1');
    expect(ids).toContain('TEST_ONLY_MOD_RING_HIGH_T2');
    expect(ids).not.toContain('TEST_ONLY_MOD_RING_HIGH_T1');
    expect(e.branches[0]?.eligible.find((c) => c.modifierId === 'TEST_ONLY_MOD_RING_LOW_T2')?.notes).toEqual(['FAMILY_FLOOR_FALLBACK_TIER']);
    expect(blockedReasons(e, 'TEST_ONLY_MOD_RING_LOW_T1')).toEqual(['BELOW_MINIMUM_MODIFIER_LEVEL']);
  });

  it('SoT 18.3 #18 Putrefaction -> exclusive sources excluded', () => {
    const e = run(armour, 'TEST_ONLY_BONE_ARMOUR_PLAIN', ['TEST_ONLY_OMEN_REPLACE_ALL']);
    expect(e.mode).toBe('putrefaction');
    expect(e.status).toBe('valid_with_warning');
    expect(codes(e)).toContain('ITEM_WILL_BE_CORRUPTED');
    expect(e.putrefaction).toEqual({ maxUnrevealed: 6, fracturedKept: 0, corrupts: true });
    expect(e.branches.every((b) => b.eligible.every((c) => c.sourceKind === 'regular'))).toBe(true);
    expect(blockedReasons(e, 'TEST_ONLY_MOD_ARMOUR_EXCL_LICH_A_S')).toContain('PUTREFACTION_EXCLUDES_EXCLUSIVE');
  });

  it('SoT 18.3 #19 Echoes -> pool unchanged; reveal reroll metadata set', () => {
    const without = run(armour, 'TEST_ONLY_BONE_ARMOUR_PLAIN');
    const withEchoes = run(armour, 'TEST_ONLY_BONE_ARMOUR_PLAIN', ['TEST_ONLY_OMEN_REROLL']);
    expect(withEchoes.branches).toEqual(without.branches);
    expect(withEchoes.reveal).toEqual({ optionCount: 3, rerollsAvailable: 1 });
  });

  it('SoT 18.3 #20 Light -> pool unchanged; recovery hint set', () => {
    expect(run(armour, 'TEST_ONLY_BONE_ARMOUR_PLAIN', ['TEST_ONLY_OMEN_ANNUL']).branches).toEqual(run(armour, 'TEST_ONLY_BONE_ARMOUR_PLAIN').branches);
    const desecrated = parsed('armour', [], {}, { existingDesecration: 'present', hasRevealedDesecratedModifier: true });
    const e = run(desecrated, 'TEST_ONLY_BONE_ARMOUR_PLAIN', ['TEST_ONLY_OMEN_ANNUL']);
    expect(e.recoveryHints).toEqual([{ kind: 'annul_desecrated_only', omenId: 'TEST_ONLY_OMEN_ANNUL', currencyId: 'TEST_ONLY_CURRENCY_RECOVERY' }]);
  });

  it('SoT 18.3 #24 partial parser state is never a final blocker-aware pool', () => {
    const unresolved = affix('TEST_ONLY_MOD_ARMOUR_S1', {
      matchedModifierId: undefined,
      candidateModifierIds: ['TEST_ONLY_MOD_ARMOUR_S1', 'TEST_ONLY_MOD_ARMOUR_S2'],
      groupsResolved: false,
      groups: [],
      possibleGroups: ['TEST_ONLY_MOD_ARMOUR_S1_GROUP', 'TEST_ONLY_MOD_ARMOUR_S2_GROUP'],
    });
    const e = run(parsed('armour', [affix('TEST_ONLY_MOD_ARMOUR_P1'), unresolved]), 'TEST_ONLY_BONE_ARMOUR_PLAIN', ['TEST_ONLY_OMEN_FORCE_SUFFIX'], 'partial');
    const branch = e.branches[0];
    expect(branch?.completeness).toBe('base_eligibility_only');
    expect(branch?.conditional.map((c) => c.modifierId).sort()).toEqual(['TEST_ONLY_MOD_ARMOUR_S1', 'TEST_ONLY_MOD_ARMOUR_S2']);
    expect(branch?.eligible.map((c) => c.modifierId)).not.toContain('TEST_ONLY_MOD_ARMOUR_S2');
    expect(e.poolCompleteness).not.toBe('final');
  });

  describe('SoT 18.3 #25 ASSUMPTION_BLOCKED interactions return unknown without a pool', () => {
    const cases: Array<[string, () => DesecrationEvaluation, string]> = [
      ['U-001 Mark + opposite-side Omen', () => run(parsed('armour', [affix('TEST_ONLY_MOD_MARK_P')]), 'TEST_ONLY_BONE_ARMOUR_PLAIN', ['TEST_ONLY_OMEN_FORCE_SUFFIX']), 'UNKNOWN_MARK_SIDE_INTERACTION'],
      ['U-002 Altered Collarbone + Putrefaction', () => run(ring(80), 'TEST_ONLY_BONE_RING_OTHERWORLDLY', ['TEST_ONLY_OMEN_REPLACE_ALL']), 'UNKNOWN_ALTERED_PUTREFACTION_INTERACTION'],
      ['U-007 fractured Mark', () => run(parsed('armour', [affix('TEST_ONLY_MOD_MARK_P', { fractured: true })]), 'TEST_ONLY_BONE_ARMOUR_PLAIN'), 'UNKNOWN_FRACTURED_MARK_INTERACTION'],
      ['U-008 Ancient floor + Mark floor', () => run(parsed('armour', [affix('TEST_ONLY_MOD_MARK_P')]), 'TEST_ONLY_BONE_ARMOUR_HIGH'), 'UNKNOWN_ANCIENT_MARK_FLOOR'],
      ['U-012 mixed open/full sides without side Omen', () => run(parsed('armour', ['P1', 'P2', 'P3'].map((s) => affix(`TEST_ONLY_MOD_ARMOUR_${s}`))), 'TEST_ONLY_BONE_ARMOUR_PLAIN'), 'UNKNOWN_MIXED_CAPACITY_SIDE_CHOICE'],
      ['U-014 existing Desecration undetermined', () => run(parsed('armour', [], {}, { existingDesecration: 'undetermined' }), 'TEST_ONLY_BONE_ARMOUR_PLAIN'), 'EXISTING_DESECRATION_UNDETERMINED'],
      ['multiple Lich Omens', () => run(bow82, 'TEST_ONLY_BONE_WEAPON_PLAIN', ['TEST_ONLY_OMEN_FORCE_LICH_A', 'TEST_ONLY_OMEN_FORCE_LICH_B']), 'UNKNOWN_MULTIPLE_LICH_OMENS'],
      ['unmapped item class', () => run(parsed('unmapped', []), 'TEST_ONLY_BONE_ARMOUR_PLAIN'), 'ITEM_CLASS_TARGET_UNMAPPED'],
    ];
    it.each(cases)('%s', (_name, evaluate, code) => {
      const e = evaluate();
      expect(e.status).toBe('unknown');
      expect(codes(e)).toContain(code);
      expect(e.branches).toEqual([]);
      expect(e.poolCompleteness).toBe('unknown');
    });
  });
});

describe('additional engine behavior', () => {
  it('replaces a same-side Mark first and applies the Mark floor', () => {
    const e = run(parsed('ring', [affix('TEST_ONLY_MOD_MARK_P')], { itemLevel: 80 }), 'TEST_ONLY_BONE_RING_PLAIN');
    expect(e.branches.map((b) => b.kind)).toEqual(['mark_replacement']);
    expect(codes(e)).toContain('MARK_REPLACED_FIRST');
    // floor(80 * 0.4) = 32: tier 30 is the family's highest eligible tier and is kept as fallback
    expect(eligibleIds(e)).toEqual(expect.arrayContaining(['TEST_ONLY_MOD_RING_LOW_T2', 'TEST_ONLY_MOD_RING_HIGH_T2']));
    expect(eligibleIds(e)).not.toContain('TEST_ONLY_MOD_RING_HIGH_T1');
  });

  it('treats both side Omens as unsupported, not invalid', () => {
    const e = run(armour, 'TEST_ONLY_BONE_ARMOUR_PLAIN', ['TEST_ONLY_OMEN_FORCE_PREFIX', 'TEST_ONLY_OMEN_FORCE_SUFFIX']);
    expect(e.status).toBe('unsupported');
    expect(codes(e)).toEqual(expect.arrayContaining(['CONFLICTING_SIDE_OMENS']));
  });

  it('reports special unique systems as unsupported even though they are not Rare', () => {
    const e = run(parsed('armour', [], { rarity: 'unique' }, { isSpecialMultiDesecrationItem: true }), 'TEST_ONLY_BONE_ARMOUR_PLAIN');
    expect(e.status).toBe('unsupported');
    expect(codes(e)).toEqual(['UNSUPPORTED_SPECIAL_ITEM']);
  });

  it('keeps natural Lich mods in the ordinary exclusive pool without a Lich Omen (SoT §7.3)', () => {
    const e = run(parsed('armour', [affix('TEST_ONLY_MOD_ARMOUR_P1')]), 'TEST_ONLY_BONE_ARMOUR_PLAIN', ['TEST_ONLY_OMEN_FORCE_SUFFIX']);
    expect(eligibleIds(e)).toContain('TEST_ONLY_MOD_ARMOUR_EXCL_LICH_A_S');
    expect(e.mechanicNotes.map((n) => n.code)).toContain('EXCLUSIVE_OPTION_GUARANTEE_NOTE');
  });

  it('refuses removal branches while fractured state is undetermined (U-011)', () => {
    const full = parsed('armour', ['P1', 'P2', 'P3', 'S1', 'S2', 'S3'].map((s) => affix(`TEST_ONLY_MOD_ARMOUR_${s}`)), { fracturedState: 'undetermined' });
    const e = run(full, 'TEST_ONLY_BONE_ARMOUR_PLAIN');
    expect(e.status).toBe('unknown');
    expect(codes(e)).toContain('FRACTURED_STATE_UNDETERMINED');
  });

  it('keeps eligible, conditional and blocked disjoint and every blocked row explained', () => {
    const e = run(armour, 'TEST_ONLY_BONE_ARMOUR_PLAIN');
    for (const b of e.branches) {
      const ids = [...b.eligible, ...b.conditional, ...b.blocked].map((c) => c.modifierId);
      expect(new Set(ids).size).toBe(ids.length);
      expect(b.blocked.every((c) => c.reasons.length > 0)).toBe(true);
      expect(b.eligible.every((c) => c.sourceRefs.length > 0)).toBe(true);
    }
  });

  it('is deterministic', () => {
    expect(run(armour, 'TEST_ONLY_BONE_ARMOUR_PLAIN')).toEqual(run(armour, 'TEST_ONLY_BONE_ARMOUR_PLAIN'));
  });
});
