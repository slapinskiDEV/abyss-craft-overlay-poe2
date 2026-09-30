// EN clipboard grammar: structural vocabulary only (spec 004). No base/class/currency/Omen/mod
// names — those come from the data pack's EN name index.
//
// Every token is `to_confirm_with_fixture` until a verbatim fixture under
// tests/fixtures/clipboard/en/ proves it (U-011). Seed values come from Exiled Exchange 2
// (MIT, commit cca30662, renderer/public/data/en/client_strings.js) as an unconfirmed reference
// (SoT §6.4).

export interface GrammarToken<T extends string | RegExp = string | RegExp> {
  value: T;
  status: 'confirmed' | 'to_confirm_with_fixture';
  fixture?: string;
}

const seed = <T extends string | RegExp>(value: T): GrammarToken<T> => ({ value, status: 'to_confirm_with_fixture' });

export const EN_GRAMMAR = {
  separator: seed('--------'),
  labels: {
    itemClass: seed('Item Class: '),
    rarity: seed('Rarity: '),
    itemLevel: seed('Item Level: '),
  },
  rarityValues: {
    normal: seed('Normal'),
    magic: seed('Magic'),
    rare: seed('Rare'),
    unique: seed('Unique'),
  },
  flags: {
    corrupted: seed('Corrupted'),
    mirrored: seed('Mirrored'),
    unidentified: seed(/^Unidentified(?:\s*\(Tier\s*\d+\))?$/),
    fracturedItem: seed('Fractured Item'),
  },
  /** Normal-copy line suffixes and advanced-copy block-type words. */
  affixMarkers: {
    fractured: seed('Fractured'),
    crafted: seed('Crafted'),
    desecrated: seed('Desecrated'),
  },
  /** Normal-copy placeholder lines for Unrevealed Desecrated modifiers. */
  unrevealed: {
    prefix: seed('Desecrated Prefix'),
    suffix: seed('Desecrated Suffix'),
  },
  /** Suffixes marking non-explicit lines in normal copy. */
  nonExplicitLineSuffix: seed(/\((implicit|rune|enchant|augmented)\)$/),
  advancedBlock: {
    header: seed(/^\{\s*(?<type>[^"}]+?)(?:\s+"(?<name>[^"]*)")?(?:\s*\(Tier:\s*(?<tier>\d+)\))?(?:\s*\(Rank:\s*\d+\))?(?:\s*—\s*(?<tags>[^}]*))?\s*\}$/),
    prefixWord: seed('Prefix Modifier'),
    suffixWord: seed('Suffix Modifier'),
  },
  /** Advanced copy shows the roll range after each value, e.g. "50(46-66)". */
  advancedValueRange: seed(/(\d+(?:\.\d+)?)\((-?\d+(?:\.\d+)?)[-–](-?\d+(?:\.\d+)?)\)/g),
  unscalableSuffix: seed(' — Unscalable Value'),
} as const;

/**
 * U-014: set to true only after verbatim fixtures prove that revealed Desecrated affixes from the
 * regular pool keep a detectable marker in both copy modes. Until then absence of Desecration is
 * never claimed.
 */
export const U014_REGULAR_REVEAL_DETECTABLE = false;

export const isConfirmed = (token: GrammarToken): boolean => token.status === 'confirmed';
