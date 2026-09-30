import { describe, expect, it } from 'vitest';
import type { DataPack } from '../../src/data/normalized/types';
import { createI18n } from '../../src/i18n/create-i18n';
import { formatDiagnostic } from '../../src/i18n/format-diagnostic';
import { createGameTermProvider, GAME_TERM_PROVIDERS } from '../../src/i18n/game/providers/registry';
import type { GameTermProviderDefinition } from '../../src/i18n/game/providers/types';
import { resolveGameLocale, resolveUiLocale } from '../../src/i18n/resolve-locale';
import { stripRePoEMarkup } from '../../src/i18n/game/providers/en';

// Minimal TEST_ONLY pack slice: only what the EN provider reads.
const pack = {
  bones: [{ id: 'test_only_bone', canonicalNameEn: 'TEST_ONLY Bone Name', descriptionEn: 'TEST_ONLY [Abyssalify|Desecrates] a thing' }],
  omens: [{ id: 'test_only_omen', canonicalNameEn: 'TEST_ONLY Omen Name', descriptionEn: 'TEST_ONLY omen\ntext' }],
  otherCurrencies: [],
  baseItems: [{ id: 'TEST_ONLY_BASE', canonicalNameEn: 'TEST_ONLY Base Name' }],
  itemClasses: [{ id: 'TEST_ONLY_CLASS', canonicalNameEn: 'TEST_ONLY Class Name' }],
  modifiers: [{ id: 'TEST_ONLY_MOD', canonicalNameEn: 'TEST_ONLY', text: '+(1-2) to [TEST_ONLY_Link|TEST_ONLY Stat]' }],
  poolNamesEn: [{ poolId: 'special:TEST_ONLY_pool', nameEn: 'TEST_ONLY Pool Name' }],
} as unknown as DataPack;

describe('locale resolution (SoT §5.6)', () => {
  it.each([
    ['pl-PL', 'pl'],
    ['pl', 'pl'],
    ['en-US', 'en'],
    ['de-DE', 'en'],
    ['fr_FR', 'en'],
    ['', 'en'],
  ])('%s -> %s', (os, expected) => expect(resolveUiLocale(os)).toBe(expected));

  it('uses official EN game terms for every UI locale (SoT §18.3 #21)', () => {
    expect(resolveGameLocale('pl')).toBe('en');
    expect(resolveGameLocale('en')).toBe('en');
  });
});

describe('EN game-term provider', () => {
  const game = createGameTermProvider(pack, 'en');

  it('returns pack names and strips RePoE link markup', () => {
    expect(game.omenName('test_only_omen')).toEqual({ text: 'TEST_ONLY Omen Name', locale: 'en', fallback: false });
    expect(game.modifierText('TEST_ONLY_MOD').text).toBe('+(1-2) to TEST_ONLY Stat');
    expect(game.description('test_only_bone').text).toBe('TEST_ONLY Desecrates a thing');
    expect(game.description('test_only_omen').text).toBe('TEST_ONLY omen text');
    expect(game.poolName('special:TEST_ONLY_pool')).toEqual({ text: 'TEST_ONLY Pool Name', locale: 'en', fallback: false });
    expect(stripRePoEMarkup('[A|B] and [C]')).toBe('B and C');
  });

  it('never invents a name for an unknown ID', () => {
    expect(game.baseItemName('TEST_ONLY_UNKNOWN')).toEqual({ text: 'TEST_ONLY_UNKNOWN', locale: 'en', fallback: true });
    expect(game.diagnostics()).toEqual([{ code: 'GAME_TERM_MISSING', params: { entityId: 'TEST_ONLY_UNKNOWN' } }]);
  });
});

describe('locale axes are independent (SoT §5.10, §18.3 #23)', () => {
  it('a TEST_ONLY game-term locale falls back to EN per missing term', () => {
    const testOnly: GameTermProviderDefinition = {
      locale: 'test-only',
      create: () => ({
        locale: 'test-only',
        currencyName: (id) => ({ text: id, locale: 'test-only', fallback: true }),
        omenName: (id) => (id === 'test_only_omen' ? { text: 'TEST_ONLY Localized', locale: 'test-only', fallback: false } : { text: id, locale: 'test-only', fallback: true }),
        baseItemName: (id) => ({ text: id, locale: 'test-only', fallback: true }),
        itemClassName: (id) => ({ text: id, locale: 'test-only', fallback: true }),
        description: (id) => ({ text: id, locale: 'test-only', fallback: true }),
        poolName: (id) => ({ text: id, locale: 'test-only', fallback: true }),
        modifierText: (id) => ({ text: id, locale: 'test-only', fallback: true }),
        diagnostics: () => [],
      }),
    };
    const game = createGameTermProvider(pack, 'test-only', [...GAME_TERM_PROVIDERS, testOnly]);
    expect(game.omenName('test_only_omen').text).toBe('TEST_ONLY Localized');
    expect(game.currencyName('test_only_bone')).toEqual({ text: 'TEST_ONLY Bone Name', locale: 'en', fallback: true });
    expect(game.diagnostics()).toContainEqual({ code: 'GAME_TERM_FALLBACK_EN', params: { entityId: 'test_only_bone' } });
  });

  it('an unregistered game locale uses EN without affecting UI locales', () => {
    expect(createGameTermProvider(pack, 'TEST_ONLY_unregistered').locale).toBe('en');
  });
});

describe('diagnostic formatting', () => {
  it('interpolates official names from entity-ID params in EN and PL', async () => {
    const game = createGameTermProvider(pack, 'en');
    for (const locale of ['en', 'pl'] as const) {
      const i18n = await createI18n(locale);
      const text = formatDiagnostic({ code: 'GAME_TERM_MISSING', params: { entityId: 'TEST_ONLY_X' } }, i18n.t.bind(i18n), game);
      expect(text.title.length).toBeGreaterThan(0);
      expect(text.detail).toContain('TEST_ONLY_X');
    }
  });

  it('switches EN -> PL live on the same instance', async () => {
    const i18n = await createI18n('en');
    const en = i18n.t('common:prefix');
    await i18n.changeLanguage('pl');
    expect(i18n.t('common:prefix')).not.toBe(en);
  });
});
