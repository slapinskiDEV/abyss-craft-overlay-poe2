import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DataPack } from '../../src/data/normalized/types';
import { EN_GRAMMAR, type GrammarToken } from '../../src/parser/en/grammar';
import { describeRealData } from '../support/real-data';

const tokens = (node: unknown, path = ''): Array<[string, GrammarToken]> => {
  if (node && typeof node === 'object' && 'status' in node && 'value' in node) return [[path, node as GrammarToken]];
  if (node && typeof node === 'object') return Object.entries(node).flatMap(([k, v]) => tokens(v, path ? `${path}.${k}` : k));
  return [];
};
const all = tokens(EN_GRAMMAR);

describe('EN grammar provenance (U-011)', () => {
  it('confirms a token only with a verbatim fixture that contains it', () => {
    for (const [path, token] of all.filter(([, t]) => t.status === 'confirmed')) {
      expect(token.fixture, path).toBeDefined();
      const file = join('tests/fixtures/clipboard/en', token.fixture ?? '');
      expect(existsSync(file), `${path}: ${file}`).toBe(true);
      const text = readFileSync(file, 'utf8');
      const value = token.value;
      expect(typeof value === 'string' ? text.includes(value) : new RegExp(value.source, value.flags.replace('g', '')).test(text), path).toBe(true);
    }
  });
});

describeRealData('EN grammar purity (spec 004)', () => {
  it('contains no game entity name', () => {
    const pack = JSON.parse(readFileSync('src/data/normalized/pack/pack.json', 'utf8')) as DataPack;
    const names = new Set([...pack.bones, ...pack.omens, ...pack.otherCurrencies, ...pack.baseItems, ...pack.itemClasses].map((e) => e.canonicalNameEn));
    const modNames = new Set(pack.modifiers.map((m) => m.canonicalNameEn).filter((n) => n.length > 0));
    for (const [path, token] of all) {
      if (typeof token.value !== 'string') continue;
      const value = token.value.trim();
      expect(names.has(value) || modNames.has(value), `${path}: ${value}`).toBe(false);
    }
  });
});
