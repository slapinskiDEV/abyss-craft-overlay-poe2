// Short explanation of what a Bone or Omen does, derived only from the evidenced rule fields of the
// data pack (spec 019, SoT §5.3 / §16.4 0.2.16) — never hand-written per entity, so it always matches
// what the engine computes. The texts are UI templates; official names are passed in unchanged.
import type { BoneDefinition, BoneTargetGroup, DataPack, OmenDefinition } from '../../data/normalized/types';

export interface ExplainPart {
  key: string;
  params?: Record<string, string | number>;
}

export function explainBone(bone: BoneDefinition): ExplainPart[] {
  const parts: ExplainPart[] = [{ key: 'workspace:explain.bone', params: { targetKey: bone.targetGroup } }];
  if (bone.maxItemLevel !== undefined) parts.push({ key: 'workspace:explain.maxItemLevel', params: { level: bone.maxItemLevel } });
  if (bone.minimumModifierLevel !== undefined) parts.push({ key: 'workspace:explain.minModifierLevel', params: { level: bone.minimumModifierLevel } });
  if (bone.unlocksSpecialPools.includes('otherworldly')) parts.push({ key: 'workspace:explain.otherworldly' });
  if (bone.releaseState === 'drop_disabled_legacy') parts.push({ key: 'workspace:explain.legacy' });
  return parts;
}

/** Target groups of the Bone families an Omen works with, in pack order. */
function omenTargets(omen: OmenDefinition, pack: DataPack): BoneTargetGroup[] {
  if (omen.compatibleBoneFamilies === 'any') return [];
  const families = new Set(omen.compatibleBoneFamilies);
  return [...new Set(pack.bones.filter((b) => families.has(b.family)).map((b) => b.targetGroup))];
}

export function explainOmen(omen: OmenDefinition, pack: DataPack): ExplainPart[] {
  const e = omen.effect;
  switch (e.kind) {
    case 'force_side':
      return [{ key: `workspace:explain.forceSide.${e.side}` }];
    case 'force_lich':
      return [{ key: 'workspace:explain.forceLich', params: { poolId: `lich:${e.lichPool}`, targetKeys: omenTargets(omen, pack).join(',') } }];
    case 'putrefaction':
      return [{ key: 'workspace:explain.putrefaction' }];
    case 'reveal_reroll':
      return [{ key: 'workspace:explain.revealReroll', params: { count: e.rerolls } }];
    case 'annul_desecrated_only': {
      const orb = pack.otherCurrencies.find((c) => c.role === 'recovery');
      return [{ key: 'workspace:explain.annulDesecratedOnly', params: { currencyId: orb?.id ?? '' } }];
    }
  }
}
