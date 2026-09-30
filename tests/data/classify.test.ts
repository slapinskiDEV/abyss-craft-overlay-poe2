import { describe, expect, it } from 'vitest';
import {
  classifyLichPool,
  classifySpecialPools,
  isOtherworldly,
  otherworldlyJewelleryClasses,
} from '../../src/data/adapters/classify';
import { rawMod } from './test-only-raw';

// Lich tags and name patterns below are the SoT §7.5 rule vocabulary, not entity data.
const noOverrides = new Map();

describe('classifyLichPool (SoT §7.5)', () => {
  it('classifies by canonical name when tags agree', () => {
    const mod = rawMod({ domain: 'desecrated', name: 'of Kurgal', implicit_tags: ['kurgal_mod'] });
    expect(classifyLichPool('TEST_ONLY_MOD', mod, noOverrides)).toMatchObject({ lichPool: 'kurgal', conflict: false, basis: 'name' });
  });

  it('flags a tag contradiction without mutating the name result', () => {
    const mod = rawMod({ domain: 'desecrated', name: 'of Ulaman', implicit_tags: ['kurgal_mod'] });
    expect(classifyLichPool('TEST_ONLY_MOD', mod, noOverrides)).toMatchObject({ lichPool: 'ulaman', conflict: true });
  });

  it('lets a curated override win and clears the conflict', () => {
    const mod = rawMod({ domain: 'desecrated', name: 'of Ulaman', implicit_tags: ['kurgal_mod'] });
    const result = classifyLichPool('TEST_ONLY_MOD', mod, new Map([['TEST_ONLY_MOD', 'kurgal']]));
    expect(result).toMatchObject({ lichPool: 'kurgal', conflict: false, basis: 'override' });
  });

  it('flags two Lich tags on one row', () => {
    const mod = rawMod({
      domain: 'desecrated',
      name: "Amanamu's",
      spawn_weights: [{ tag: 'amanamu_mod', weight: 1 }, { tag: 'ulaman_mod', weight: 1 }],
    });
    expect(classifyLichPool('TEST_ONLY_MOD', mod, noOverrides)).toMatchObject({ lichPool: 'amanamu', conflict: true });
  });

  it('ignores zero-weight spawn entries as tag evidence', () => {
    const mod = rawMod({ domain: 'desecrated', name: 'TEST_ONLY_NAME', spawn_weights: [{ tag: 'ulaman_mod', weight: 0 }] });
    expect(classifyLichPool('TEST_ONLY_MOD', mod, noOverrides)).toMatchObject({ conflict: false, basis: 'none' });
  });

  it('never assigns a Lich pool outside the desecrated domain', () => {
    const mod = rawMod({ domain: 'item', name: 'of Kurgal' });
    expect(classifyLichPool('TEST_ONLY_MOD', mod, noOverrides).lichPool).toBeUndefined();
  });
});

describe('Otherworldly (SoT §7.6)', () => {
  const gated = rawMod({
    domain: 'desecrated',
    spawn_weights: [
      { tag: 'ring', weight: 0 },
      { tag: 'belt', weight: 0 },
      { tag: 'breach_desecration', weight: 1 },
      { tag: 'default', weight: 0 },
    ],
  });

  it('requires the desecrated domain and a positive gate entry', () => {
    expect(isOtherworldly(gated)).toBe(true);
    expect(isOtherworldly({ ...gated, domain: 'item' })).toBe(false);
    expect(isOtherworldly({ ...gated, spawn_weights: [{ tag: 'breach_desecration', weight: 0 }] })).toBe(false);
  });

  it('keeps zero-weight jewellery tags as applicable classes', () => {
    expect(otherworldlyJewelleryClasses(gated)).toEqual(['belt', 'ring']);
  });

  it('adds the otherworldly special pool', () => {
    expect(classifySpecialPools(gated, false)).toEqual(['otherworldly']);
  });
});

describe('jewel families (SoT §7.7)', () => {
  it('marks jewel-applicable desecrated families only', () => {
    expect(classifySpecialPools(rawMod({ domain: 'desecrated', name: 'Lightless' }), true)).toEqual(['jewel_lightless']);
    expect(classifySpecialPools(rawMod({ domain: 'desecrated', name: 'of the Abyss' }), true)).toEqual(['jewel_of_the_abyss']);
    expect(classifySpecialPools(rawMod({ domain: 'desecrated', name: 'of the Abyss' }), false)).toEqual([]);
    expect(classifySpecialPools(rawMod({ domain: 'item', name: 'of the Abyss' }), true)).toEqual([]);
  });
});
