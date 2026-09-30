// Data-driven selector options for the UI (SoT §0.2 rule 7, spec 005 "UI helpers"). Reuses the
// pre-validation predicates so disabled options and engine verdicts cannot diverge.
import type { DataPack, OmenDefinition } from '../../data/normalized/types';
import type { ParsedItem } from '../../parser/common/types';
import type { Diagnostic } from '../diagnostics/diagnostic';
import { buildContext } from './context';
import { boneChecks, omenChecks } from './prevalidate';
import type { OmenPhase } from './types';

const blocking = (d: Diagnostic) => d.severity !== 'info' && d.severity !== 'warning';

export function boneOptions(item: ParsedItem, data: DataPack, opts: { includeLegacy: boolean }) {
  const ctx = buildContext(item, '', [], data);
  return data.bones
    .filter((b) => opts.includeLegacy || b.releaseState !== 'drop_disabled_legacy')
    .map((bone) => {
      const reasons = boneChecks(ctx, bone);
      return { boneId: bone.id, selectable: !reasons.some(blocking), reasons };
    });
}

export function omenOptions(_item: ParsedItem, boneId: string | null, activeOmens: readonly string[], data: DataPack) {
  const bone = boneId ? data.bones.find((b) => b.id === boneId) : undefined;
  const active = activeOmens.map((id) => data.omens.find((o) => o.id === id)).filter((o): o is OmenDefinition => o !== undefined);
  return data.omens.map((omen): { omenId: string; phase: OmenPhase; effectKind: OmenDefinition['effect']['kind']; selectable: boolean; reasons: Diagnostic[] } => {
    const others = active.filter((o) => o.id !== omen.id);
    const reasons = omenChecks(bone, omen, [omen, ...others]);
    return { omenId: omen.id, phase: omen.phase, effectKind: omen.effect.kind, selectable: !reasons.some(blocking), reasons };
  });
}

const BONE_COMPATIBILITY_CODES = new Set(['OMEN_INCOMPATIBLE_WITH_BONE', 'LICH_OMEN_INCOMPATIBLE_WITH_BONE', 'ALTERED_COLLARBONE_LICH_OMEN_CONFLICT']);

/**
 * Omens that can be used on this item at all (SoT §16.4, 0.2.9): compatible with the chosen Bone,
 * or, before a Bone is chosen, with at least one Bone usable on the item. Conflicts between Omens
 * are not considered here; they stay visible and disabled with a reason.
 */
export function usableOmenIds(item: ParsedItem, boneId: string | null, data: DataPack): Set<string> {
  const bones = boneId ? [boneId] : boneOptions(item, data, { includeLegacy: true }).filter((o) => o.selectable).map((o) => o.boneId);
  const usable = new Set<string>();
  for (const b of bones) {
    const bone = data.bones.find((x) => x.id === b);
    for (const omen of data.omens) if (!omenChecks(bone, omen, []).some((r) => BONE_COMPATIBILITY_CODES.has(r.code))) usable.add(omen.id);
  }
  return usable;
}

/**
 * Default Bone for an item without a remembered choice (SoT §16.4, 0.2.11): the first usable,
 * non-legacy Bone in pack order that has neither an item-level limit nor a minimum-modifier-level
 * floor, i.e. the unrestricted one; otherwise the first usable Bone. Data-driven, no names.
 */
export function defaultBoneId(item: ParsedItem, data: DataPack): string | undefined {
  const usable = boneOptions(item, data, { includeLegacy: false }).filter((o) => o.selectable).map((o) => data.bones.find((b) => b.id === o.boneId)!);
  return (usable.find((b) => b.maxItemLevel === undefined && b.minimumModifierLevel === undefined) ?? usable[0])?.id;
}
