import { describe, expect, it } from 'vitest';
import { boneOptions, omenOptions } from '../../src/domain';
import { ENGINE_PACK as data, affix, parsed } from '../fixtures/data/test-only-engine-pack';

const armour = parsed('armour', [affix('TEST_ONLY_MOD_ARMOUR_P1')]);

describe('data-driven selector options (SoT §0.2 rule 7)', () => {
  it('lists every pack Bone, hiding legacy ones by default', () => {
    const ids = boneOptions(armour, data, { includeLegacy: false }).map((o) => o.boneId);
    expect(ids).not.toContain('TEST_ONLY_BONE_LEGACY');
    expect(boneOptions(armour, data, { includeLegacy: true }).map((o) => o.boneId)).toContain('TEST_ONLY_BONE_LEGACY');
    expect(ids).toEqual(data.bones.filter((b) => b.releaseState === 'current').map((b) => b.id));
  });

  it('marks only target-compatible Bones selectable, with the same reasons as the engine', () => {
    const options = boneOptions(armour, data, { includeLegacy: false });
    expect(options.filter((o) => o.selectable).map((o) => o.boneId)).toEqual(['TEST_ONLY_BONE_ARMOUR_PLAIN', 'TEST_ONLY_BONE_ARMOUR_HIGH']);
    expect(options.find((o) => o.boneId === 'TEST_ONLY_BONE_WEAPON_PLAIN')?.reasons.map((r) => r.code)).toEqual(['BONE_INCOMPATIBLE_ITEM_CLASS']);
  });

  it('disables Lich Omens for an incompatible Bone family and conflicting side Omens', () => {
    const options = omenOptions(armour, 'TEST_ONLY_BONE_ARMOUR_PLAIN', ['TEST_ONLY_OMEN_FORCE_PREFIX'], data);
    const byId = new Map(options.map((o) => [o.omenId, o]));
    expect(byId.get('TEST_ONLY_OMEN_FORCE_LICH_A')?.selectable).toBe(false);
    expect(byId.get('TEST_ONLY_OMEN_FORCE_SUFFIX')?.reasons.map((r) => r.code)).toContain('CONFLICTING_SIDE_OMENS');
    expect(byId.get('TEST_ONLY_OMEN_REPLACE_ALL')?.reasons.map((r) => r.code)).toContain('UNKNOWN_PUTREFACTION_OMEN_COMBINATION');
    expect(byId.get('TEST_ONLY_OMEN_REROLL')).toMatchObject({ selectable: true, phase: 'reveal' });
    expect(options.map((o) => o.omenId)).toEqual(data.omens.map((o) => o.id));
  });
});
