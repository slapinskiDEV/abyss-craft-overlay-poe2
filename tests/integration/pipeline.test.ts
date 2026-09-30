// SoT §18.4 integration: clipboard text -> parser -> engine -> view model, plus golden eligible IDs
// for the canonical fixtures (spec 007 regression workflow). Set UPDATE_GOLDEN=1 to rewrite.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appStableKey } from '../../src/data/adapters/rules';
import type { DataPack } from '../../src/data/normalized/types';
import { evaluateDesecration } from '../../src/domain';
import { createGameTermProvider, GAME_TERM_PROVIDERS } from '../../src/i18n/game/providers/registry';
import type { GameTermProviderDefinition } from '../../src/i18n/game/providers/types';
import type { ParsedItem } from '../../src/parser/common/types';
import { createClipboardParser } from '../../src/parser/registry';
import { buildRows, DEFAULT_FILTERS } from '../../src/renderer/view-model/rows';
import { ENGINE_PACK, affix, parsed } from '../fixtures/data/test-only-engine-pack';
import { describeRealData } from '../support/real-data';

describe('pipeline invariants (SoT §18.4)', () => {
  const item = parsed('armour', [affix('TEST_ONLY_MOD_ARMOUR_P1'), affix('TEST_ONLY_MOD_ARMOUR_S1')]);
  const evaluate = () => evaluateDesecration({ item, currency: 'TEST_ONLY_BONE_ARMOUR_PLAIN', activeOmens: [], data: ENGINE_PACK, parserConfidence: 'full' });

  it('the domain result does not depend on the UI language (no locale input exists)', () => {
    // evaluateDesecration takes no locale; the same input always gives the same output.
    expect(evaluate()).toEqual(evaluate());
  });

  it('replacing the game-term provider changes labels only, never the domain result', () => {
    const before = evaluate();
    const testOnly: GameTermProviderDefinition = {
      locale: 'test-only',
      create: () => ({
        locale: 'test-only',
        currencyName: (id) => ({ text: `L:${id}`, locale: 'test-only', fallback: false }),
        omenName: (id) => ({ text: `L:${id}`, locale: 'test-only', fallback: false }),
        baseItemName: (id) => ({ text: `L:${id}`, locale: 'test-only', fallback: false }),
        itemClassName: (id) => ({ text: `L:${id}`, locale: 'test-only', fallback: false }),
        poolName: (id) => ({ text: `L:${id}`, locale: 'test-only', fallback: false }),
        modifierText: (id) => ({ text: `L:${id}`, locale: 'test-only', fallback: false }),
        diagnostics: () => [],
      }),
    };
    const en = createGameTermProvider(ENGINE_PACK, 'en');
    const other = createGameTermProvider(ENGINE_PACK, 'test-only', [...GAME_TERM_PROVIDERS, testOnly]);
    const ids = (g: typeof en) => buildRows(before, 'union', 'eligible', DEFAULT_FILTERS, g).map((r) => r.modifierId).sort();
    expect(ids(other)).toEqual(ids(en));
    expect(evaluate()).toEqual(before);
  });
});

describeRealData('clipboard -> parser -> engine on the real pack', () => {
  const pack = JSON.parse(readFileSync('src/data/normalized/pack/pack.json', 'utf8')) as DataPack;
  const plate = pack.baseItems.find((b) => b.id === 'Metadata/Items/Armours/BodyArmours/FourBodyStr6Endgame'); // SoT §21
  const plateClass = pack.itemClasses.find((c) => c.id === plate?.itemClassId)?.canonicalNameEn;

  it('fails closed until verbatim fixtures confirm the Desecration markers (U-011, U-014)', () => {
    const text = [`Item Class: ${plateClass}`, 'Rarity: Rare', 'TEST_ONLY Generated Name', plate?.canonicalNameEn, '--------', 'Item Level: 82', ''].join('\n');
    const parsedResult = createClipboardParser(pack).parse(text, 'auto');
    if (!parsedResult.ok) throw new Error(JSON.stringify(parsedResult.diagnostics));
    const e = evaluateDesecration({ item: parsedResult.item, parserConfidence: parsedResult.confidence, currency: appStableKey('Preserved Rib'), activeOmens: [], data: pack });
    expect(e.status).toBe('unknown');
    expect(e.reasons.map((r) => r.code)).toContain('EXISTING_DESECRATION_UNDETERMINED');
    expect(e.branches).toEqual([]);
    // Spec 009: the base pool still answers "what can this base get" for the same clipboard.
    expect(e.basePool.status).toBe('valid');
    expect(e.basePool.sides.map((b) => b.side)).toEqual(['prefix', 'suffix']);
    expect(e.basePool.sides.every((b) => b.eligible.length > 0 && b.completeness === 'base_eligibility_only')).toBe(true);
  });

  it('base pool equals the exact open-slot pool for an item without modifiers (spec 009)', () => {
    const item: ParsedItem = {
      parserLocale: 'en', copyMode: 'advanced', rawText: '', rarity: 'rare', baseTypeText: plate?.canonicalNameEn ?? '', baseItemId: plate?.id, itemClassId: plate?.itemClassId,
      itemLevel: 82, baseTags: plate?.tags ?? [], corrupted: false, mirrored: false, unidentified: false, prefixes: [], suffixes: [], unknownAffixes: [],
      fracturedState: 'determined', isTimeLostJewel: false,
      abyss: { hasUnrevealedDesecratedModifier: false, hasRevealedDesecratedModifier: false, hasMarkOfAbyssalLord: false, isSpecialMultiDesecrationItem: false, existingDesecration: 'absent', markState: 'absent' },
    };
    for (const currency of ['Preserved Rib', 'Ancient Rib']) {
      const e = evaluateDesecration({ item, parserConfidence: 'full', currency: appStableKey(currency), activeOmens: [], data: pack });
      const ids = (bs: typeof e.branches) => bs.map((b) => `${b.side}:${b.eligible.map((x) => x.modifierId).sort().join(',')}`);
      expect(e.status).toBe('valid');
      expect(ids(e.basePool.sides)).toEqual(ids(e.branches));
    }
  });

  it('matches the golden eligible pools for the canonical fixtures', () => {
    const clean = (b: typeof plate, itemLevel: number): ParsedItem => ({
      parserLocale: 'en', copyMode: 'advanced', rawText: '', rarity: 'rare', baseTypeText: b?.canonicalNameEn ?? '', baseItemId: b?.id, itemClassId: b?.itemClassId,
      itemLevel, baseTags: b?.tags ?? [], corrupted: false, mirrored: false, unidentified: false, prefixes: [], suffixes: [], unknownAffixes: [],
      fracturedState: 'determined', isTimeLostJewel: false,
      abyss: { hasUnrevealedDesecratedModifier: false, hasRevealedDesecratedModifier: false, hasMarkOfAbyssalLord: false, isSpecialMultiDesecrationItem: false, existingDesecration: 'absent', markState: 'absent' },
    });
    const bow = pack.baseItems.find((b) => b.itemClassId === 'Bow' && b.releaseState === 'released');
    const cases = {
      'ornate-plate__preserved-rib__dextral': { item: clean(plate, 82), currency: 'Preserved Rib', omens: ['Omen of Dextral Necromancy'] },
      'ornate-plate__preserved-rib__sinistral': { item: clean(plate, 82), currency: 'Preserved Rib', omens: ['Omen of Sinistral Necromancy'] },
      'bow__preserved-jawbone__liege__sinistral': { item: clean(bow, 82), currency: 'Preserved Jawbone', omens: ['Omen of the Liege', 'Omen of Sinistral Necromancy'] },
    };
    const actual = Object.fromEntries(
      Object.entries(cases).map(([name, c]) => {
        const e = evaluateDesecration({ item: c.item, parserConfidence: 'full', currency: appStableKey(c.currency), activeOmens: c.omens.map(appStableKey), data: pack });
        return [name, { dataPackId: pack.manifest.dataPackId, base: c.item.baseItemId, status: e.status, branches: e.branches.map((b) => ({ id: b.id, completeness: b.completeness, eligible: b.eligible.map((x) => x.modifierId).sort() })) }];
      }),
    );
    const file = join('tests', 'integration', 'golden', 'canonical-pools.json');
    if (process.env.UPDATE_GOLDEN === '1' || !existsSync(file)) writeFileSync(file, `${JSON.stringify(actual, null, 2)}\n`);
    const golden = JSON.parse(readFileSync(file, 'utf8')) as typeof actual;
    // Pack changes must be reviewed: a new dataPackId requires re-approving the golden file.
    expect(actual).toEqual(golden);
  });
});
