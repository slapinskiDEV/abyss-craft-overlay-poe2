// Affix -> candidate modifier IDs (spec 004 "Affix matching"). Never picks one of several
// candidates: ambiguity is kept as a candidate set (SoT §9.5).
import type { AffixSide, DataPack, ModifierDefinition } from '../../data/normalized/types';
import type { StatMatch, StatMatcher } from './stat-matcher';

export interface AffixCandidates {
  candidateModifierIds: string[];
  groupsResolved: boolean;
  possibleGroups: string[];
  addsTagsResolved: boolean;
  /** Side implied by the candidates when they all agree. */
  impliedSide?: AffixSide;
}

const setKey = (ids: Iterable<string>): string => [...new Set(ids)].sort().join('|');
const MAX_PARTITIONS = 64;

export class AffixMatcher {
  private readonly bySignature = new Map<string, ModifierDefinition[]>();

  constructor(pack: DataPack, private readonly stats: StatMatcher) {
    const translated = new Set(pack.statTranslationsEn.flatMap((e) => e.statIds));
    for (const mod of pack.modifiers) {
      const signature = setKey(mod.stats.map((s) => s.id).filter((id) => translated.has(id)));
      if (!signature) continue;
      const list = this.bySignature.get(signature);
      if (list) list.push(mod);
      else this.bySignature.set(signature, [mod]);
    }
  }

  /** Every way to read `lines` as a sequence of stat translations covering all lines exactly. */
  segmentations(lines: readonly string[]): StatMatch[][] {
    const out: StatMatch[][] = [];
    const walk = (pos: number, acc: StatMatch[]) => {
      if (out.length >= MAX_PARTITIONS) return;
      if (pos === lines.length) {
        out.push(acc);
        return;
      }
      for (const m of this.stats.matchAt(lines, pos)) walk(pos + m.lineCount, [...acc, m]);
    };
    walk(0, []);
    return out;
  }

  /** Candidate mods whose translated stat set equals the tokens' stats and whose ranges fit. */
  modsFor(tokens: readonly StatMatch[], filter: (m: ModifierDefinition) => boolean): ModifierDefinition[] {
    const values = new Map<string, number | null>();
    for (const t of tokens) for (const [id, v] of t.values) values.set(id, v);
    const candidates = this.bySignature.get(setKey(values.keys())) ?? [];
    return candidates.filter((mod) => filter(mod) && [...values].every(([id, v]) => v === null || inRange(mod, id, v)));
  }
}

function inRange(mod: ModifierDefinition, statId: string, value: number): boolean {
  const stat = mod.stats.find((s) => s.id === statId);
  if (!stat) return false;
  const lo = Math.min(stat.min, stat.max);
  const hi = Math.max(stat.min, stat.max);
  // Display rounding (e.g. per-second conversions) makes inverted values approximate.
  const tolerance = Number.isInteger(value) ? 1e-6 : Math.max(1, Math.abs(value) * 0.02);
  return value >= lo - tolerance && value <= hi + tolerance;
}

export function summarize(mods: readonly ModifierDefinition[]): AffixCandidates {
  const ids = [...new Set(mods.map((m) => m.id))].sort();
  const groupKeys = new Set(mods.map((m) => setKey(m.groups)));
  const tagKeys = new Set(mods.map((m) => setKey(m.addsTags)));
  const sides = new Set(mods.map((m) => m.side));
  const [onlySide] = sides;
  return {
    candidateModifierIds: ids,
    groupsResolved: mods.length > 0 && groupKeys.size === 1,
    possibleGroups: [...new Set(mods.flatMap((m) => m.groups))].sort(),
    addsTagsResolved: mods.length > 0 && tagKeys.size === 1,
    ...(sides.size === 1 && onlySide ? { impliedSide: onlySide } : {}),
  };
}
