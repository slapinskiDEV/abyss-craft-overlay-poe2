import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { DataPack } from '../../src/data/normalized/types';
import { UI_LOCALES, type UiLocaleDefinition } from '../../src/i18n/ui/registry';
import { checkEntityLiterals, checkTranslations } from '../../src/i18n/validate-translations';
import { describeRealData } from '../support/real-data';

const clone = (): UiLocaleDefinition[] => JSON.parse(JSON.stringify(UI_LOCALES)) as UiLocaleDefinition[];

describe('UI translations (SoT §5.8, §18.5)', () => {
  it('EN and PL are complete and consistent', () => {
    expect(checkTranslations(UI_LOCALES)).toEqual([]);
  });

  it('detects a key missing from PL', () => {
    const locales = clone();
    delete (locales[1]?.resources.common as Record<string, unknown>).prefix;
    expect(checkTranslations(locales).map((i) => `${i.code}:${i.locale}:${i.key}`)).toContain('KEY_MISSING:pl:common:prefix');
  });

  it('detects orphan keys and variable mismatches', () => {
    const locales = clone();
    const plCommon = locales[1]?.resources.common as Record<string, unknown>;
    plCommon.TEST_ONLY_orphan = 'x';
    plCommon.retry = 'Odczytaj {{TEST_ONLY_var}}';
    const codes = checkTranslations(locales).map((i) => i.code);
    expect(codes).toContain('ORPHAN_KEY');
    expect(codes).toContain('VARIABLE_MISMATCH');
  });

  it('requires every CLDR plural form for the locale', () => {
    const locales = clone();
    delete (locales[1]?.resources.workspace as Record<string, unknown>).eligibleCount_few;
    expect(checkTranslations(locales).some((i) => i.code === 'PLURAL_FORM_MISSING' && i.detail === 'few')).toBe(true);
  });

  it('rejects probability wording (SoT §17)', () => {
    const locales = clone();
    (locales[0]?.resources.common as Record<string, unknown>).close = 'TEST_ONLY 25% chance';
    expect(checkTranslations(locales).map((i) => i.code)).toContain('PROBABILITY_WORDING');
  });

  it('rejects game entity names written into resources', () => {
    const locales = clone();
    (locales[1]?.resources.common as Record<string, unknown>).close = 'Użyj TEST_ONLY_BONE_ARMOUR_PLAIN';
    expect(checkEntityLiterals(locales, ['TEST_ONLY_BONE_ARMOUR_PLAIN']).map((i) => i.code)).toEqual(['ENTITY_LITERAL']);
    expect(checkEntityLiterals(UI_LOCALES, ['TEST_ONLY_BONE_ARMOUR_PLAIN'])).toEqual([]);
  });
});

describeRealData('UI resources against real entity names', () => {
  it('contain no official entity name as literal text (SoT §5.8)', () => {
    const pack = JSON.parse(readFileSync('src/data/normalized/pack/pack.json', 'utf8')) as DataPack;
    const names = [...pack.bones, ...pack.omens, ...pack.otherCurrencies, ...pack.baseItems, ...pack.itemClasses].map((e) => e.canonicalNameEn);
    expect(checkEntityLiterals(UI_LOCALES, names)).toEqual([]);
  });
});
