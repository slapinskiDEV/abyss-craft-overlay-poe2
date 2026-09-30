// Parser tests on a TEST_ONLY pack. Clipboard texts here are synthetic (structural labels from the
// unconfirmed EN grammar + TEST_ONLY entities); they can never confirm a grammar token.
import { describe, expect, it } from 'vitest';
import type { ParsedItemResult } from '../../src/parser/common/types';
import { normalizeClipboard, splitSections } from '../../src/parser/common/text';
import { invertHandlers } from '../../src/parser/common/stat-matcher';
import { createClipboardParser } from '../../src/parser/registry';
import { base, mod, testPack, translation } from '../fixtures/data/test-only-pack';

const pack = testPack({
  bases: [
    base('TEST_ONLY_BASE_PLATE', { canonicalNameEn: 'TEST_ONLY Plate' }),
    base('TEST_ONLY_BASE_TWIN_A', { canonicalNameEn: 'TEST_ONLY Twin', tags: ['TEST_ONLY_tag_armour', 'default'] }),
    base('TEST_ONLY_BASE_TWIN_B', { canonicalNameEn: 'TEST_ONLY Twin', tags: ['TEST_ONLY_tag_armour', 'TEST_ONLY_tag_extra', 'default'] }),
  ],
  modifiers: [
    mod('TEST_ONLY_MOD_LIFE_T1', { canonicalNameEn: 'TEST_ONLY Hale', groups: ['TEST_ONLY_GROUP_LIFE'], stats: [{ id: 'TEST_ONLY_stat_life', min: 20, max: 29 }] }),
    mod('TEST_ONLY_MOD_LIFE_T2', { canonicalNameEn: 'TEST_ONLY Healthy', groups: ['TEST_ONLY_GROUP_LIFE'], stats: [{ id: 'TEST_ONLY_stat_life', min: 30, max: 39 }] }),
    mod('TEST_ONLY_MOD_STR', { side: 'suffix', canonicalNameEn: 'TEST_ONLY of Strength', stats: [{ id: 'TEST_ONLY_stat_str', min: 5, max: 8 }] }),
    mod('TEST_ONLY_MOD_AMBIG_A', { side: 'suffix', groups: ['TEST_ONLY_GROUP_A'], stats: [{ id: 'TEST_ONLY_stat_amb', min: 1, max: 10 }] }),
    mod('TEST_ONLY_MOD_AMBIG_B', { side: 'suffix', groups: ['TEST_ONLY_GROUP_B'], stats: [{ id: 'TEST_ONLY_stat_amb', min: 1, max: 10 }] }),
    mod('TEST_ONLY_MOD_EXCL', { side: 'suffix', domain: 'desecrated', sourceKind: 'desecrated_exclusive', stats: [{ id: 'TEST_ONLY_stat_excl', min: 1, max: 5 }] }),
    mod('TEST_ONLY_MOD_EXCL_OTHER_BASE', { side: 'suffix', domain: 'desecrated', sourceKind: 'desecrated_exclusive', spawnWeights: [{ tag: 'TEST_ONLY_tag_mace', weight: 1 }, { tag: 'default', weight: 0 }], stats: [{ id: 'TEST_ONLY_stat_excl_other', min: 1, max: 5 }] }),
    mod('TEST_ONLY_MOD_MARK', { canonicalNameEn: 'TEST_ONLY Marked', spawnWeights: [{ tag: 'default', weight: 0 }], stats: [{ id: 'TEST_ONLY_stat_mark', min: 1, max: 1 }] }),
    mod('TEST_ONLY_MOD_NEG', { side: 'suffix', stats: [{ id: 'TEST_ONLY_stat_neg', min: -10, max: -5 }] }),
  ],
  translations: [
    translation(['TEST_ONLY_stat_life'], '+{0} to [TEST_ONLY_Life|TEST_ONLY maximum Life]'),
    translation(['TEST_ONLY_stat_str'], '+{0} to TEST_ONLY Strength'),
    translation(['TEST_ONLY_stat_amb'], '{0}% increased TEST_ONLY Ambiguity'),
    translation(['TEST_ONLY_stat_excl'], '{0}% increased TEST_ONLY Exclusive Power'),
    translation(['TEST_ONLY_stat_excl_other'], '{0}% increased TEST_ONLY Mace Power'),
    translation(['TEST_ONLY_stat_mark'], 'Bears the TEST_ONLY Mark'),
    translation(['TEST_ONLY_stat_neg'], '{0}% reduced TEST_ONLY Cost', [['negate']]),
  ],
  markIds: ['TEST_ONLY_MOD_MARK'],
});
const parser = createClipboardParser(pack);

const item = (body: string, header = 'Item Class: TEST_ONLY Armours\nRarity: Rare\nTEST_ONLY Doom Name\nTEST_ONLY Plate') =>
  `${header}\n--------\nItem Level: 80\n--------\n${body}\n`;
const ok = (r: ParsedItemResult) => {
  if (!r.ok) throw new Error(`parse failed: ${JSON.stringify(r.diagnostics)}`);
  return r;
};

describe('text helpers', () => {
  it('normalizes line endings and invisible characters', () => {
    expect(normalizeClipboard('a\r\nb\rc d​')).toEqual(['a', 'b', 'c d']);
  });
  it('splits sections on separators', () => {
    expect(splitSections(['a', '--------', 'b', '', 'c'], (l) => l === '--------').map((s) => s.map((l) => l.text))).toEqual([['a'], ['b', 'c']]);
  });
  it('inverts display handlers or reports them unknown', () => {
    expect(invertHandlers(10, ['negate'])).toBe(-10);
    expect(invertHandlers(2, ['per_minute_to_per_second'])).toBe(120);
    expect(invertHandlers(1, ['TEST_ONLY_unknown_handler'])).toBeNull();
  });
});

describe('locale gate (SoT §9.3)', () => {
  it('rejects non-item text', () => {
    expect(parser.parse('TEST_ONLY hello', 'auto')).toMatchObject({ ok: false, diagnostics: [{ code: 'NOT_A_POE2_ITEM' }] });
  });
  it('rejects item-shaped text from an unsupported client language', () => {
    const r = parser.parse('TEST_ONLY_Label_A: x\nTEST_ONLY_Label_B: y\n--------\nTEST_ONLY_Label_C: 80\n', 'auto');
    expect(r).toMatchObject({ ok: false, diagnostics: [{ code: 'UNSUPPORTED_CLIPBOARD_LOCALE' }] });
  });
});

describe('advanced copy', () => {
  const r = ok(
    parser.parse(
      item('{ Prefix Modifier "TEST_ONLY Hale" (Tier: 2) — Life }\n+25(20-29) to TEST_ONLY maximum Life\n{ Suffix Modifier "TEST_ONLY of Strength" (Tier: 1) — Attribute }\n+8(5-8) to TEST_ONLY Strength'),
      'auto',
    ),
  );

  it('resolves header, base and item level through the pack', () => {
    expect(r.item).toMatchObject({ parserLocale: 'en', copyMode: 'advanced', rarity: 'rare', itemClassId: 'TEST_ONLY_CLASS_ARMOUR', baseItemId: 'TEST_ONLY_BASE_PLATE', itemLevel: 80 });
  });

  it('matches affixes to unique IDs with sides from block headers', () => {
    expect(r.item.prefixes.map((a) => a.matchedModifierId)).toEqual(['TEST_ONLY_MOD_LIFE_T1']);
    expect(r.item.suffixes.map((a) => a.matchedModifierId)).toEqual(['TEST_ONLY_MOD_STR']);
    expect(r.item.prefixes[0]?.groups).toEqual(['TEST_ONLY_GROUP_LIFE']);
  });

  it('stays partial and undetermined while grammar tokens are unconfirmed (U-011, U-014)', () => {
    expect(r.confidence).toBe('partial');
    expect(r.item.abyss.existingDesecration).toBe('undetermined');
    expect(r.item.fracturedState).toBe('undetermined');
    expect(r.diagnostics.map((d) => d.code)).toContain('MARKER_UNCONFIRMED');
  });
});

describe('ambiguity is never collapsed (SoT §9.5)', () => {
  it('keeps several candidates and unions their groups', () => {
    const r = ok(parser.parse(item('{ Suffix Modifier — TEST_ONLY }\n5(1-10)% increased TEST_ONLY Ambiguity'), 'auto'));
    const [affix] = r.item.suffixes;
    expect(affix?.matchedModifierId).toBeUndefined();
    expect(affix?.candidateModifierIds).toEqual(['TEST_ONLY_MOD_AMBIG_A', 'TEST_ONLY_MOD_AMBIG_B']);
    expect(affix?.groupsResolved).toBe(false);
    expect(affix?.possibleGroups).toEqual(['TEST_ONLY_GROUP_A', 'TEST_ONLY_GROUP_B']);
  });

  it('narrows tiers by the rolled value', () => {
    const r = ok(parser.parse(item('{ Prefix Modifier — Life }\n+29(20-39) to TEST_ONLY maximum Life'), 'auto'));
    expect(r.item.prefixes[0]?.matchedModifierId).toBe('TEST_ONLY_MOD_LIFE_T1');
  });
});

describe('Abyss state', () => {
  it('detects the Mark by modifier ID, including a placeholder-free template', () => {
    const r = ok(parser.parse(item('{ Prefix Modifier "TEST_ONLY Marked" — TEST_ONLY }\nBears the TEST_ONLY Mark'), 'auto'));
    expect(r.item.abyss).toMatchObject({ hasMarkOfAbyssalLord: true, markSide: 'prefix', markState: 'present' });
  });

  it('treats a uniquely matched exclusive modifier as existing Desecration', () => {
    const r = ok(parser.parse(item('{ Suffix Modifier — TEST_ONLY }\n3(1-5)% increased TEST_ONLY Exclusive Power'), 'auto'));
    expect(r.item.abyss.existingDesecration).toBe('present');
    expect(r.item.abyss.hasRevealedDesecratedModifier).toBe(true);
  });

  it('ignores an exclusive modifier that cannot occur on the base (spec 017 C2)', () => {
    const r = ok(parser.parse(item('{ Suffix Modifier — TEST_ONLY }\n3(1-5)% increased TEST_ONLY Mace Power'), 'auto'));
    expect(r.item.suffixes[0]?.candidateModifierIds).toEqual([]);
    expect(r.item.abyss.existingDesecration).not.toBe('present');
    expect(r.diagnostics.map((d) => d.code)).toContain('AFFIX_UNRESOLVED');
  });

  it('reads negated values through RePoE handlers', () => {
    const r = ok(parser.parse(item('{ Suffix Modifier — TEST_ONLY }\n7(5-10)% reduced TEST_ONLY Cost'), 'auto'));
    expect(r.item.suffixes[0]?.matchedModifierId).toBe('TEST_ONLY_MOD_NEG');
  });
});

describe('normal copy', () => {
  it('matches lines and infers sides from unique candidates', () => {
    const r = ok(parser.parse(item('+25 to TEST_ONLY maximum Life\n+8 to TEST_ONLY Strength'), 'auto'));
    expect(r.item.copyMode).toBe('normal');
    expect(r.item.prefixes.map((a) => a.matchedModifierId)).toEqual(['TEST_ONLY_MOD_LIFE_T1']);
    expect(r.item.suffixes.map((a) => a.matchedModifierId)).toEqual(['TEST_ONLY_MOD_STR']);
    expect(r.diagnostics.map((d) => d.code)).toContain('NORMAL_COPY_LIMITED_DETAIL');
  });

  it('leaves unmatched lines unresolved with unknown side', () => {
    const r = ok(parser.parse(item('TEST_ONLY unknown modifier text'), 'auto'));
    expect(r.item.unknownAffixes).toHaveLength(1);
    expect(r.item.unknownAffixes[0]?.candidateModifierIds).toEqual([]);
    expect(r.item.abyss.markState).toBe('undetermined');
  });
});

describe('normal copy with hybrid modifiers (spec 017 C1)', () => {
  const hybridPack = (withSingleStr: boolean) =>
    testPack({
      bases: [base('TEST_ONLY_BASE_PLATE', { canonicalNameEn: 'TEST_ONLY Plate' })],
      modifiers: [
        mod('TEST_ONLY_MOD_LIFE_T1', { stats: [{ id: 'TEST_ONLY_stat_life', min: 20, max: 29 }] }),
        mod('TEST_ONLY_MOD_HYBRID', { groups: ['TEST_ONLY_GROUP_HYBRID'], stats: [{ id: 'TEST_ONLY_stat_life', min: 20, max: 29 }, { id: 'TEST_ONLY_stat_str', min: 5, max: 8 }] }),
        ...(withSingleStr ? [mod('TEST_ONLY_MOD_STR', { side: 'suffix', stats: [{ id: 'TEST_ONLY_stat_str', min: 5, max: 8 }] })] : []),
      ],
      translations: [translation(['TEST_ONLY_stat_life'], '+{0} to TEST_ONLY maximum Life'), translation(['TEST_ONLY_stat_str'], '+{0} to TEST_ONLY Strength')],
      markIds: [],
    });
  const pair = '+25 to TEST_ONLY maximum Life\n+6 to TEST_ONLY Strength';

  it('accepts the only split: two lines as one hybrid affix', () => {
    const r = ok(createClipboardParser(hybridPack(false)).parse(item(pair), 'auto'));
    expect(r.item.prefixes.map((a) => [a.matchedModifierId, a.rawLines.length])).toEqual([['TEST_ONLY_MOD_HYBRID', 2]]);
  });

  it('reports several splits as ambiguous and matches nothing', () => {
    const r = ok(createClipboardParser(hybridPack(true)).parse(item(pair), 'auto'));
    expect(r.diagnostics).toContainEqual(expect.objectContaining({ code: 'AFFIX_AMBIGUOUS', params: { splits: 2 } }));
    expect([...r.item.prefixes, ...r.item.suffixes]).toEqual([]);
  });

  it('stays fast when many hybrid lines end in an unrecognized line', () => {
    const body = [...Array.from({ length: 14 }, () => pair), 'TEST_ONLY unknown modifier text'].join('\n');
    const start = performance.now();
    const r = ok(createClipboardParser(hybridPack(true)).parse(item(body), 'auto'));
    expect(performance.now() - start).toBeLessThan(500);
    expect(r.diagnostics).toContainEqual(expect.objectContaining({ code: 'AFFIX_AMBIGUOUS', params: { splits: 0 } }));
  });
});

describe('robustness (spec 017 C4, C5)', () => {
  it('stays fast on a very long line that looks like an unfinished block header', () => {
    const start = performance.now();
    const r = parser.parse(item(`{ ${'TEST_ONLY — '.repeat(3000)}`), 'auto');
    expect(performance.now() - start).toBeLessThan(500);
    expect(r.ok).toBe(true);
  });

  it('counts Unrevealed placeholder lines per side in normal copy', () => {
    const r = ok(parser.parse(item('Desecrated Prefix\n+8 to TEST_ONLY Strength'), 'auto'));
    expect(r.item.abyss.unrevealedCount).toEqual({ prefix: 1, suffix: 0 });
  });
});

describe('insufficient parses (SoT §9.4)', () => {
  it('fails on an unknown base', () => {
    const r = parser.parse(item('+8 to TEST_ONLY Strength', 'Item Class: TEST_ONLY Armours\nRarity: Rare\nTEST_ONLY Doom Name\nTEST_ONLY Unknown Base'), 'auto');
    expect(r).toMatchObject({ ok: false, confidence: 'insufficient' });
    expect(r.diagnostics.map((d) => d.code)).toContain('BASE_TYPE_UNRESOLVED');
  });

  it('fails when one base name maps to bases with different tags', () => {
    const r = parser.parse(item('+8 to TEST_ONLY Strength', 'Item Class: TEST_ONLY Armours\nRarity: Rare\nTEST_ONLY Doom Name\nTEST_ONLY Twin'), 'auto');
    expect(r.ok).toBe(false);
    expect(r.diagnostics).toContainEqual(expect.objectContaining({ code: 'BASE_TYPE_UNRESOLVED', params: expect.objectContaining({ reason: 'ambiguous' }) }));
  });

  it('fails without an item level', () => {
    const r = parser.parse('Item Class: TEST_ONLY Armours\nRarity: Rare\nTEST_ONLY Doom Name\nTEST_ONLY Plate\n--------\n+8 to TEST_ONLY Strength\n', 'auto');
    expect(r.diagnostics.map((d) => d.code)).toContain('ITEM_LEVEL_MISSING');
  });
});

describe('determinism', () => {
  it('ignores line-ending and whitespace perturbations', () => {
    const text = item('{ Prefix Modifier "TEST_ONLY Hale" (Tier: 2) — Life }\n+25(20-29) to TEST_ONLY maximum Life');
    const a = ok(parser.parse(text, 'auto'));
    const b = ok(parser.parse(text.replace(/\n/g, '\r\n').replace(/Item Level/, '​Item Level'), 'auto'));
    expect({ ...b.item, rawText: '' }).toEqual({ ...a.item, rawText: '' });
  });
});
