// Pre-validation (SoT §14.1, spec 005 "Status mapping"). `invalid` only where the incompatibility
// is evidenced; undocumented combinations are `unknown` or `unsupported`.
import type { BoneDefinition, OmenDefinition } from '../../data/normalized/types';
import type { ParserConfidence } from '../../parser/common/types';
import { diag, type Diagnostic } from '../diagnostics/diagnostic';
import type { EvaluationStatus } from './types';
import { hasUsableEvidence, type CraftContext } from './context';

/** Checks that depend only on the item and a Bone (shared with boneOptions). */
export function boneChecks(ctx: CraftContext, bone: BoneDefinition): Diagnostic[] {
  const { item, target } = ctx;
  const out: Diagnostic[] = [];
  if (!hasUsableEvidence(bone.evidence)) out.push(diag('RULE_EVIDENCE_MISSING', { currencyId: bone.id }));
  if (item.rarity !== 'rare') out.push(diag('ITEM_NOT_RARE', { currencyId: bone.id }));
  if (!target) out.push(diag('ITEM_CLASS_TARGET_UNMAPPED', { itemClassId: item.itemClassId ?? '' }));
  else if (target.target !== bone.targetGroup) out.push(diag('BONE_INCOMPATIBLE_ITEM_CLASS', { currencyId: bone.id, itemClassId: target.itemClassId }, target.evidence.evidenceRefs));
  if (bone.maxItemLevel !== undefined && item.itemLevel !== undefined && item.itemLevel > bone.maxItemLevel) {
    out.push(diag('GNAWED_ITEM_LEVEL_TOO_HIGH', { currencyId: bone.id, maxItemLevel: bone.maxItemLevel }, bone.evidence.evidenceRefs));
  }
  if (bone.releaseState === 'drop_disabled_legacy') out.push(diag('LEGACY_CURRENCY', { currencyId: bone.id }));
  return out;
}

/** Checks for one Omen against the Bone and the other active Omens (shared with omenOptions). */
export function omenChecks(bone: BoneDefinition | undefined, omen: OmenDefinition, others: readonly OmenDefinition[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  if (!hasUsableEvidence(omen.evidence)) out.push(diag('RULE_EVIDENCE_MISSING', { omenId: omen.id }));
  if (bone && omen.compatibleBoneFamilies !== 'any' && !omen.compatibleBoneFamilies.includes(bone.family)) {
    const code =
      omen.effect.kind !== 'force_lich'
        ? 'OMEN_INCOMPATIBLE_WITH_BONE'
        : bone.family === 'altered_collarbone'
          ? 'ALTERED_COLLARBONE_LICH_OMEN_CONFLICT'
          : 'LICH_OMEN_INCOMPATIBLE_WITH_BONE';
    out.push(diag(code, { omenId: omen.id, currencyId: bone.id }, omen.evidence.evidenceRefs));
  }
  const kinds = others.filter((o) => o.id !== omen.id).map((o) => o.effect);
  if (omen.effect.kind === 'force_side' && kinds.some((k) => k.kind === 'force_side' && k.side !== (omen.effect as { side: string }).side)) {
    out.push(diag('CONFLICTING_SIDE_OMENS', { omenId: omen.id }));
  }
  if (omen.effect.kind === 'force_lich' && kinds.some((k) => k.kind === 'force_lich')) out.push(diag('UNKNOWN_MULTIPLE_LICH_OMENS', { omenId: omen.id }));
  const putrefactionWith = (k: { kind: string }) => k.kind === 'force_side' || k.kind === 'force_lich';
  if ((omen.effect.kind === 'putrefaction' && kinds.some(putrefactionWith)) || (putrefactionWith(omen.effect) && kinds.some((k) => k.kind === 'putrefaction'))) {
    const putrefaction = omen.effect.kind === 'putrefaction' ? omen : others.find((o) => o.effect.kind === 'putrefaction');
    out.push(diag('UNKNOWN_PUTREFACTION_OMEN_COMBINATION', { omenId: putrefaction?.id ?? omen.id }));
  }
  return out;
}

/**
 * `item` scope: the exact item check (SoT §14.1). `base` scope (SoT §14.7): skips only the checks for
 * item state the clipboard may not reveal; every evidenced invalidity and combination U-item stays.
 */
export type ValidationScope = 'item' | 'base';

export function preValidate(ctx: CraftContext, parserConfidence: ParserConfidence, scope: ValidationScope = 'item'): Diagnostic[] {
  const itemScope = scope === 'item';
  const { item, bone, data } = ctx;
  const out: Diagnostic[] = [];
  if (data.manifest.validated !== true) out.push(diag('DATA_CONFLICT'));

  // Recognized special systems are unsupported rather than invalid (SoT §14.1).
  if (item.abyss.isSpecialMultiDesecrationItem) return [...out, diag('UNSUPPORTED_SPECIAL_ITEM')];
  if (item.isTimeLostJewel) return [...out, diag('SPECIAL_JEWEL_RULE', item.baseItemId ? { baseItemId: item.baseItemId } : undefined)];

  if (parserConfidence === 'insufficient' || item.itemLevel === undefined || item.itemClassId === undefined) out.push(diag('PARSER_INSUFFICIENT'));
  if (!bone) out.push(diag('UNKNOWN_CURRENCY'));
  for (const id of ctx.unknownOmenIds) out.push(diag('UNKNOWN_OMEN', { omenId: id }));
  if (bone) out.push(...boneChecks(ctx, bone));
  if (item.corrupted) out.push(diag('ITEM_CORRUPTED'));
  if (item.abyss.existingDesecration === 'present') out.push(diag('ITEM_ALREADY_DESECRATED'));
  else if (itemScope && item.abyss.existingDesecration === 'undetermined') out.push(diag('EXISTING_DESECRATION_UNDETERMINED'));
  // SoT U-015: not evidenced either way, so the exact check is unknown; the base pool stays.
  if (itemScope && item.unidentified) out.push(diag('ITEM_STATE_UNDOCUMENTED', { state: 'unidentified' }));
  if (itemScope && item.mirrored) out.push(diag('ITEM_STATE_UNDOCUMENTED', { state: 'mirrored' }));

  const seen = new Set<string>();
  for (const omen of ctx.omens) {
    for (const d of omenChecks(bone, omen, ctx.omens)) {
      const key = `${d.code}|${JSON.stringify(d.params)}`;
      if (d.code === 'CONFLICTING_SIDE_OMENS' || d.code === 'UNKNOWN_MULTIPLE_LICH_OMENS' || d.code === 'UNKNOWN_PUTREFACTION_OMEN_COMBINATION') {
        if (seen.has(d.code)) continue;
        seen.add(d.code);
      } else if (seen.has(key)) continue;
      seen.add(key);
      out.push(d);
    }
  }

  if (itemScope) {
    if (!ctx.limits) out.push(diag('AFFIX_LIMIT_UNKNOWN', { itemClassId: item.itemClassId ?? '' }));
    if (item.unknownAffixes.length > 0) out.push(diag('AFFIX_CAPACITY_UNDETERMINED'));
    if (item.abyss.markState === 'undetermined') out.push(diag('MARK_STATE_UNDETERMINED'));
    if (parserConfidence === 'partial') out.push(diag('PARSER_PARTIAL_MOD_GROUPS'));
  }

  if (ctx.putrefaction) {
    if (bone?.family === 'altered_collarbone') out.push(diag('UNKNOWN_ALTERED_PUTREFACTION_INTERACTION', { omenId: ctx.putrefaction.id, currencyId: bone.id }));
    if (itemScope && item.abyss.markState === 'present') out.push(diag('UNKNOWN_PUTREFACTION_MARK_INTERACTION', { omenId: ctx.putrefaction.id }));
    if (itemScope && item.fracturedState !== 'determined') out.push(diag('FRACTURED_STATE_UNDETERMINED'));
  }
  return out;
}

const RANK: Record<string, number> = { error: 4, unsupported: 3, unknown: 2, warning: 1, info: 0 };

export function aggregateStatus(diagnostics: readonly Diagnostic[]): EvaluationStatus {
  const worst = Math.max(0, ...diagnostics.map((d) => RANK[d.severity] ?? 0));
  return worst === 4 ? 'invalid' : worst === 3 ? 'unsupported' : worst === 2 ? 'unknown' : worst === 1 ? 'valid_with_warning' : 'valid';
}
