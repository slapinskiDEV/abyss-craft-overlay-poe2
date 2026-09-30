// Free affix slots on the copied item (SoT §16.4 header hint, 0.2.9). Uses the evidenced per-class
// limits of the data pack; never a hardcoded affix count.
import type { AffixSide, DataPack } from '../../data/normalized/types';
import type { ParsedItem } from '../../parser/common/types';

export interface SideSlots { used: number; max: number; free: number }

export type AffixSlots =
  | {
      state: 'determined';
      prefix: SideSlots;
      suffix: SideSlots;
      /**
       * `recognized_only`: counted from the recognized modifiers while existing Desecration is
       * undetermined (U-011, U-014); an unrevealed Desecrated modifier may not be counted.
       */
      basis: 'complete' | 'recognized_only';
    }
  | { state: 'undetermined'; reason: 'NOT_RARE' | 'NO_AFFIX_LIMIT' | 'AFFIX_SIDE_UNKNOWN' | 'UNIDENTIFIED' };

export function affixSlots(item: ParsedItem, data: DataPack): AffixSlots {
  if (item.rarity !== 'rare') return { state: 'undetermined', reason: 'NOT_RARE' };
  const limits = data.affixLimits.find((l) => l.itemClassId === item.itemClassId && l.rarity === 'rare');
  if (!limits) return { state: 'undetermined', reason: 'NO_AFFIX_LIMIT' };
  if (item.unknownAffixes.length > 0) return { state: 'undetermined', reason: 'AFFIX_SIDE_UNKNOWN' };
  // Explicit modifiers are hidden until identified (SoT U-015).
  if (item.unidentified) return { state: 'undetermined', reason: 'UNIDENTIFIED' };
  const side = (s: AffixSide, max: number): SideSlots => {
    const used = (s === 'prefix' ? item.prefixes : item.suffixes).length;
    return { used, max, free: Math.max(0, max - used) };
  };
  return {
    state: 'determined',
    prefix: side('prefix', limits.maxPrefixes),
    suffix: side('suffix', limits.maxSuffixes),
    basis: item.abyss.existingDesecration === 'absent' ? 'complete' : 'recognized_only',
  };
}

/**
 * Default side filter (SoT §16.4, 0.2.11): only the side with free slots when exactly one side has
 * them; both sides otherwise (both free, both full, or undetermined). A view default only: whether
 * Desecration can also pick the full side is unverified (U-012), and the UI says so.
 */
export function defaultSides(slots: AffixSlots): AffixSide[] {
  if (slots.state !== 'determined') return ['prefix', 'suffix'];
  const open = (['prefix', 'suffix'] as const).filter((s) => slots[s].free > 0);
  return open.length === 1 ? [...open] : ['prefix', 'suffix'];
}
