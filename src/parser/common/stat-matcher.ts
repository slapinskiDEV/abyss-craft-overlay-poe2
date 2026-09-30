// Reverse stat translation: clipboard text -> stat IDs + raw values, using the pack's RePoE
// translation templates (spec 004 "Affix matching" step 1).
import type { StatTranslationEntry } from '../../data/normalized/types';

export interface StatMatch {
  /** Raw stat value per stat ID; `null` when a display handler cannot be inverted. */
  values: Map<string, number | null>;
  lineCount: number;
}

// Inverse of RePoE display handlers. Rounding variants (…_Ndp, …_if_required) are inverted the
// same way and checked with a tolerance. Unknown handlers yield `null` (value not checked).
const INVERSE: Record<string, (v: number) => number> = {
  negate: (v) => -v,
  double: (v) => v / 2,
  negate_and_double: (v) => -v / 2,
  per_minute_to_per_second: (v) => v * 60,
  milliseconds_to_seconds: (v) => v * 1000,
  deciseconds_to_seconds: (v) => v * 10,
  divide_by_ten: (v) => v * 10,
  divide_by_one_hundred: (v) => v * 100,
  divide_by_two: (v) => v * 2,
  divide_by_five: (v) => v * 5,
  times_twenty: (v) => v / 20,
};
const baseHandler = (name: string): string => name.replace(/_(\d)dp(_if_required)?$|_if_required$/, '');

export function invertHandlers(display: number, handlers: readonly string[]): number | null {
  let value = display;
  for (const h of [...handlers].reverse()) {
    const inverse = INVERSE[baseHandler(h)];
    if (!inverse) return null;
    value = inverse(value);
  }
  return value;
}

const stripMarkup = (text: string): string => text.replace(/\[([^\]|]*)\|([^\]]*)\]/g, '$2').replace(/\[([^\]]*)\]/g, '$1');
const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NUMBER = '([+-]?\\d+(?:\\.\\d+)?)';

interface CompiledVariant {
  statIds: string[];
  lines: RegExp[];
  placeholderOrder: number[]; // stat index per capture group
  conditions: StatTranslationEntry['variants'][number]['conditions'];
  handlers: string[][];
  lineCount: number;
}

function compileVariant(entry: StatTranslationEntry, variant: StatTranslationEntry['variants'][number]): CompiledVariant {
  const placeholderOrder: number[] = [];
  const lines = stripMarkup(variant.template)
    .split('\n')
    .map((line) => {
      let pattern = '';
      let last = 0;
      for (const m of line.matchAll(/\{(\d+)(?::[^}]*)?\}/g)) {
        pattern += escapeRegex(line.slice(last, m.index));
        const statIndex = Number(m[1]);
        placeholderOrder.push(statIndex);
        pattern += NUMBER;
        last = (m.index ?? 0) + m[0].length;
      }
      pattern += escapeRegex(line.slice(last));
      return new RegExp(`^${pattern}$`);
    });
  return { statIds: entry.statIds, lines, placeholderOrder, conditions: variant.conditions, handlers: variant.indexHandlers, lineCount: lines.length };
}

const satisfies = (value: number, c: { min?: number; max?: number; negated?: boolean } | undefined): boolean => {
  if (!c || (c.min === undefined && c.max === undefined)) return true;
  const inside = (c.min === undefined || value >= c.min - 1e-9) && (c.max === undefined || value <= c.max + 1e-9);
  return c.negated ? !inside : inside;
};

export class StatMatcher {
  private readonly variants: CompiledVariant[];

  constructor(entries: readonly StatTranslationEntry[]) {
    this.variants = entries.flatMap((e) => e.variants.map((v) => compileVariant(e, v)));
  }

  /** All interpretations of the lines starting at `start` (a template may span several lines). */
  matchAt(lines: readonly string[], start: number): StatMatch[] {
    const out: StatMatch[] = [];
    for (const v of this.variants) {
      if (start + v.lineCount > lines.length) continue;
      const captured: string[] = [];
      let ok = true;
      for (let i = 0; i < v.lineCount && ok; i += 1) {
        const m = lines[start + i]?.match(v.lines[i] as RegExp);
        if (!m) ok = false;
        else captured.push(...m.slice(1));
      }
      if (!ok) continue;
      // Every stat of the entry is part of the signature; stats without a displayed placeholder
      // (e.g. flag stats) carry no value to check.
      const values = new Map<string, number | null>(v.statIds.map((id) => [id, null]));
      v.placeholderOrder.forEach((statIndex, group) => {
        const statId = v.statIds[statIndex];
        const display = Number(captured[group]);
        if (statId !== undefined) values.set(statId, invertHandlers(display, v.handlers[statIndex] ?? []));
      });
      const conditionsHold = [...values.entries()].every(([statId, raw]) => {
        const idx = v.statIds.indexOf(statId);
        return raw === null || satisfies(raw, v.conditions[idx]);
      });
      if (conditionsHold) out.push({ values, lineCount: v.lineCount });
    }
    return out;
  }
}
