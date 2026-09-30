// Spec 019: the summary is derived from rule fields only, so it matches what the engine computes.
import { describe, expect, it } from 'vitest';
import { explainBone, explainOmen } from '../../src/renderer/view-model/explain';
import { ENGINE_PACK } from '../fixtures/data/test-only-engine-pack';

describe('explain (spec 019)', () => {
  it('describes a Bone from its target group, level limit, floor and special pools', () => {
    const bone = { ...ENGINE_PACK.bones[0]!, targetGroup: 'jewellery' as const, maxItemLevel: 64, minimumModifierLevel: 40, unlocksSpecialPools: ['otherworldly' as const] };
    expect(explainBone(bone).map((p) => p.key)).toEqual([
      'workspace:explain.bone',
      'workspace:explain.maxItemLevel',
      'workspace:explain.minModifierLevel',
      'workspace:explain.otherworldly',
    ]);
  });

  it('describes a Lich Omen with the target groups of its compatible Bone families', () => {
    const omen = ENGINE_PACK.omens.find((o) => o.effect.kind === 'force_lich')!;
    const [part] = explainOmen(omen, ENGINE_PACK);
    expect(part?.key).toBe('workspace:explain.forceLich');
    const families = new Set(omen.compatibleBoneFamilies === 'any' ? [] : omen.compatibleBoneFamilies);
    const expected = [...new Set(ENGINE_PACK.bones.filter((b) => families.has(b.family)).map((b) => b.targetGroup))].join(',');
    expect(part?.params).toMatchObject({ targetKeys: expected });
  });

  it('covers every Omen effect kind', () => {
    for (const omen of ENGINE_PACK.omens) expect(explainOmen(omen, ENGINE_PACK).length).toBeGreaterThan(0);
  });
});
