// Branch generation (SoT §14.3 Cases A–D; U-001, U-007, U-008, U-012 fail closed).
import type { AffixSide } from '../../data/normalized/types';
import { diag, type Diagnostic } from '../diagnostics/diagnostic';
import type { CraftContext, IndexedAffix } from './context';
import type { BranchKind } from './types';

export interface BranchPlan {
  id: string;
  kind: BranchKind;
  side: AffixSide;
  removed?: IndexedAffix;
}

export interface BranchGeneration {
  branches: BranchPlan[];
  diagnostics: Diagnostic[];
}

const plan = (kind: BranchKind, side: AffixSide, removed?: IndexedAffix): BranchPlan => ({
  id: `${kind}:${side}:${removed?.index ?? '-'}`,
  kind,
  side,
  ...(removed ? { removed } : {}),
});

export function generateBranches(ctx: CraftContext): BranchGeneration {
  const { item, limits, bone, sideOmen } = ctx;
  if (!limits) return { branches: [], diagnostics: [] };
  const onSide = (side: AffixSide) => ctx.affixes.filter((a) => a.affix.side === side);
  const limit = (side: AffixSide) => (side === 'prefix' ? limits.maxPrefixes : limits.maxSuffixes);
  const isOpen = (side: AffixSide) => onSide(side).length < limit(side);
  const forcedSide = sideOmen?.effect.kind === 'force_side' ? sideOmen.effect.side : undefined;

  const removals = (side: AffixSide): BranchGeneration => {
    if (item.fracturedState !== 'determined') return { branches: [], diagnostics: [diag('FRACTURED_STATE_UNDETERMINED')] };
    const removable = onSide(side).filter((a) => !a.affix.fractured);
    return removable.length === 0
      ? { branches: [], diagnostics: [diag('NO_REMOVABLE_AFFIX_ON_SIDE', { side })] }
      : { branches: removable.map((a) => plan('removal', side, a)), diagnostics: [] };
  };

  // Case A — Mark of the Abyssal Lord is replaced first.
  const mark = ctx.affixes.find((a) => a.affix.isMarkOfAbyssalLord);
  if (item.abyss.markState === 'present' && mark && mark.affix.side !== 'unknown') {
    if (item.fracturedState !== 'determined') return { branches: [], diagnostics: [diag('FRACTURED_STATE_UNDETERMINED')] };
    if (mark.affix.fractured) return { branches: [], diagnostics: [diag('UNKNOWN_FRACTURED_MARK_INTERACTION')] };
    if (forcedSide && forcedSide !== mark.affix.side) return { branches: [], diagnostics: [diag('UNKNOWN_MARK_SIDE_INTERACTION', { omenId: sideOmen?.id ?? '' })] };
    if (bone?.minimumModifierLevel !== undefined) return { branches: [], diagnostics: [diag('UNKNOWN_ANCIENT_MARK_FLOOR', { currencyId: bone.id })] };
    return { branches: [plan('mark_replacement', mark.affix.side, mark)], diagnostics: [diag('MARK_REPLACED_FIRST')] };
  }

  // Side Omen — Case B (open) or Case C (full).
  if (forcedSide) return isOpen(forcedSide) ? { branches: [plan('open_slot', forcedSide)], diagnostics: [] } : removals(forcedSide);

  // No side Omen — Case D.
  const prefixOpen = isOpen('prefix');
  const suffixOpen = isOpen('suffix');
  if (prefixOpen && suffixOpen) return { branches: [plan('open_slot', 'prefix'), plan('open_slot', 'suffix')], diagnostics: [] };
  if (prefixOpen !== suffixOpen) return { branches: [], diagnostics: [diag('UNKNOWN_MIXED_CAPACITY_SIDE_CHOICE')] };
  const p = removals('prefix');
  const s = removals('suffix');
  const branches = [...p.branches, ...s.branches];
  // Fully affixed: if neither side has a removable affix, report both reasons.
  return { branches, diagnostics: branches.length > 0 ? [] : [...p.diagnostics, ...s.diagnostics] };
}
