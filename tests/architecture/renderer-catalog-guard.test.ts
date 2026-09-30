// SoT §0.2 rule 7, §16.4, §18.3 #27: production renderer code holds no hand-written catalog of
// PoE2 entities; every option and label comes from the data pack.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DataPack } from '../../src/data/normalized/types';
import { describeRealData } from '../support/real-data';

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
const renderer = files(join('src', 'renderer')).map((path) => ({ path, text: readFileSync(path, 'utf8') }));

describe('renderer catalog guard', () => {
  it('contains no TEST_ONLY entity', () => {
    expect(renderer.filter((f) => /TEST_ONLY/.test(f.text)).map((f) => f.path)).toEqual([]);
  });
});

describe('title bar (spec 018)', () => {
  it('declares no OS drag region: in the non-focusable overlay it swallowed button clicks on Windows', () => {
    expect(readFileSync(join('src', 'renderer', 'styles', 'theme.css'), 'utf8')).not.toMatch(/app-region/);
  });
});

describeRealData('renderer catalog guard against the real pack', () => {
  it('contains no real Bone, Omen, currency, base, class or pool name or ID', () => {
    const pack = JSON.parse(readFileSync('src/data/normalized/pack/pack.json', 'utf8')) as DataPack;
    const needles = [
      ...[...pack.bones, ...pack.omens, ...pack.otherCurrencies].flatMap((e) => [e.id, e.gameMetadataId, e.canonicalNameEn]),
      ...pack.baseItems.flatMap((b) => [b.id, b.canonicalNameEn]),
      ...pack.itemClasses.map((c) => c.canonicalNameEn),
      ...pack.poolNamesEn.map((p) => p.nameEn), // spec 017 B3
    ].filter((n) => n.length > 3);
    const hits = renderer.flatMap((f) => needles.filter((n) => new RegExp(`['"\`]${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`).test(f.text)).map((n) => `${f.path}: ${n}`));
    expect(hits).toEqual([]);
  });
});
