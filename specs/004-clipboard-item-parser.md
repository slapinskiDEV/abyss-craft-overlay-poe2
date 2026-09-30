# 004 — Clipboard item parser

**SoT refs:** §1.3, §5.7, §5.10, §7.8, §8, §9, §12.1, §18.2, §19.1, U-005, U-006, U-011, U-014

## Goal

Turn English PoE2 clipboard text (normal `Ctrl+C` or advanced `Ctrl+Alt+C`) into a
language-independent `ParsedItem` with diagnostics and a `ParserConfidence`, through a
parser-adapter registry. Never guess a modifier ID; report every uncertainty.

## In scope

- Parser-adapter registry (`src/parser/registry/`) and the EN adapter (`src/parser/en/`).
- Shared pipeline pieces (`src/parser/common/`).
- Header, flags, properties, affix blocks, advanced-copy metadata.
- Affix matching against the pack; effective-tag inputs (`adds_tags`) for 005.
- Abyss state (Unrevealed/Revealed Desecrated, Mark) with explicit determinability.
- Special item recognition (U-005, U-006).

## Out of scope

- Non-EN clipboard (SoT §9.1); only the registry exists for future adapters.
- Clipboard access (001); craft legality (005).

## Interfaces / contracts

### Axis 3 — parser locales (SoT §5.7, §5.10)

```ts
interface ClipboardParserAdapter {                  // SoT §5.7
  locale: string;                                   // 'en'
  detect(raw: string): number;                      // 0..1 confidence from structural labels only
  parse(raw: string): ParsedItemResult;
}
interface ClipboardParserAdapterDefinition {
  locale: string;
  create(pack: DataPack): ClipboardParserAdapter;   // EN adapter uses pack.nameIndexEn +
                                                    // pack.statTranslationsEn (002)
}
export const PARSER_ADAPTERS: readonly ClipboardParserAdapterDefinition[];  // [en]

function parseClipboard(raw: string, pack: DataPack, clipboardLocale: 'auto' | string): ParsedItemResult;
// clipboardLocale is 'auto' or a registered adapter locale (MVP: 'en', SoT §5.6); unknown values
// are rejected by settings validation (001), never branched on here.
```

- `auto`: run every adapter's `detect`; the best score must reach the adapter's threshold and beat
  the runner-up. No confident match -> `UNSUPPORTED_CLIPBOARD_LOCALE` (SoT §9.3). If the text has
  no item structure at all -> `NOT_A_POE2_ITEM`. The UI locale is never an input.
- Adding a parser locale needs only a new adapter + fixtures + a name index for that locale
  (SoT §5.7 step 4); it needs no UI locale or game-term provider (SoT §5.10).

```ts
type ParsedItemResult =
  | { ok: true; item: ParsedItem; confidence: ParserConfidence; diagnostics: ParserDiagnostic[] }
  | { ok: false; confidence: 'insufficient'; diagnostics: ParserDiagnostic[] };

interface ParserDiagnostic { code: ParserCode; severity: 'error'|'warning'|'info'; params?: Record<string, string|number>; lineIndex?: number }

type ParserCode =
  | 'NOT_A_POE2_ITEM' | 'UNSUPPORTED_CLIPBOARD_LOCALE'
  | 'BASE_TYPE_UNRESOLVED' | 'ITEM_CLASS_UNRESOLVED' | 'ITEM_LEVEL_MISSING'
  | 'AFFIX_UNRESOLVED' | 'AFFIX_AMBIGUOUS' | 'AFFIX_SIDE_UNKNOWN'
  | 'MARKER_UNCONFIRMED'              // U-011
  | 'DESECRATED_STATE_UNDETERMINED'   // U-014
  | 'MARK_UNRESOLVED'
  | 'SPECIAL_ITEM_DETECTED' | 'TIME_LOST_JEWEL_DETECTED'
  | 'NORMAL_COPY_LIMITED_DETAIL';
```

Parser codes are part of the shared code registry `src/shared/diagnostic-codes.ts` (005), so
003's parity test covers them.

### ParsedItem

SoT §8 shape (`parserLocale: 'en' | 'unknown'`) with these additive fields:

```ts
interface ParsedAffix {
  // ...SoT §8 fields...
  candidateModifierIds: string[];     // every ID still consistent with the text
  groupsResolved: boolean;            // all candidates share an identical groups set
  possibleGroups: string[];           // union of candidates' groups (for conditional blocking, 005)
  addsTagsResolved: boolean;          // all candidates share identical addsTags
}

interface ParsedItem {
  // ...SoT §8 fields...
  fracturedState: 'determined' | 'undetermined';   // 'determined' only if the fractured marker
                                                   // for this copy mode is confirmed (U-011)
  abyss: {
    // ...SoT §8 fields...
    existingDesecration: 'present' | 'absent' | 'undetermined';   // U-014
    markState: 'present' | 'absent' | 'undetermined';
  };
}
```

- `fracturedState: 'undetermined'` means `ParsedAffix.fractured === false` is not a claim;
  005 then refuses removal branches and Putrefaction (`FRACTURED_STATE_UNDETERMINED`).
- `matchedModifierId` only when exactly one candidate remains (SoT §9.5). `groups` filled only when
  `groupsResolved`.
- `existingDesecration`:
  - `present` — an Unrevealed/Desecrated marker (confirmed by fixture) is seen, or an affix is
    uniquely matched to a `sourceKind: 'desecrated_exclusive'` modifier (SoT U-014 says
    `desecratedSource !== regular`; `sourceKind` is the SoT §7.2 field for that);
  - `absent` — only when the Desecrated/Unrevealed markers for this copy mode are `confirmed`
    (U-011) **and** U-014 is resolved for this copy mode (a fixture proves regular-source revealed
    Desecrated affixes carry a detectable marker);
  - `undetermined` — otherwise, with `DESECRATED_STATE_UNDETERMINED`.
  SoT `hasUnrevealedDesecratedModifier` / `hasRevealedDesecratedModifier` stay booleans meaning
  "detected"; they are not a claim of absence.

### Grammar (structural vocabulary only)

`src/parser/en/grammar.ts` may contain only: separator line, header labels (item class, rarity,
item level, …), rarity value words, flag lines (corrupted/mirrored/unidentified), affix marker
words (fractured/crafted/desecrated/unrevealed), advanced-copy block syntax. It must not contain
base, class, currency, Omen, modifier or unique names — those come from the pack's EN name index.

```ts
interface GrammarToken { value: string | RegExp; status: 'confirmed' | 'to_confirm_with_fixture'; fixture?: string }
```

A token becomes `confirmed` only through a verbatim fixture under `tests/fixtures/clipboard/en/`
that contains it. Seed values from Exiled Exchange 2 are allowed as unconfirmed references
(SoT §6.4, U-011).

### Pipeline (SoT §9.2)

1. Normalize line endings/invisible chars/NBSP.
2. Detect locale via registry.
3. Split sections on separator.
4. Header: item class and base resolved via name index (`ITEM_CLASS_UNRESOLVED`,
   `BASE_TYPE_UNRESOLVED`); magic-item base = longest name-index match within the class.
5. Flags/properties: item level, corrupted, mirrored, unidentified.
6. Affix blocks (advanced: block header gives side/name/tier; normal: side from matching only,
   `NORMAL_COPY_LIMITED_DETAIL`).
7. Affix matching: EN stat translations -> stat IDs/values -> candidates with equal stat-ID set,
   values in range, compatible side, and plausibly on this base (ordinary spawnable or
   desecrated-domain applicable); advanced name/tier narrows. Hybrid mods: advanced groups lines;
   normal copy keeps every consistent adjacent-line partition.
8. Mark detection (SoT §12.1): candidate affix names `Abyssal` (prefix) / `of the Abyss` (suffix)
   are only a trigger; the affix counts as Mark only if its candidate IDs ⊆ `abyssMarkModifierIds`
   (002). Jewel-exclusive `of the Abyss` rows are therefore never Mark. Mixed candidates ->
   `markState: 'undetermined'`, `MARK_UNRESOLVED`.
9. Special items via `specialItems` (002) -> `SPECIAL_ITEM_DETECTED` / `TIME_LOST_JEWEL_DETECTED`.
10. Confidence.

### Confidence (SoT §9.4)

- `insufficient`: locale unsupported, base/class unresolved, or item level missing.
- `full`: base + ilvl known; every affix has a known side and `groupsResolved`; no unconfirmed
  marker affected a decision.
- `partial`: otherwise. The parser never "upgrades" confidence by dropping unresolved affixes.

`existingDesecration` / `markState` are reported separately from confidence; 005 decides their
effect.

## Algorithm/design choice

- **Adopted:** SoT §9.2 pipeline and §5.7 adapter interface.
- **Clarification — candidate sets instead of single IDs:** keeping `candidateModifierIds`,
  `possibleGroups` and `addsTagsResolved` lets 005 prove whether an unresolved affix can matter
  (conditional blocking) instead of discarding it. Preserves SoT §9.5 (no guessed ID) and §9.4;
  improves precision. Verified by ambiguity tests.
- **Clarification — tri-state Abyss fields:** required to honour U-014/U-011 without changing the
  SoT booleans' meaning.

## Acceptance criteria

1. EN fixtures for every SoT §18.2 case parse as recorded in reviewed snapshots.
2. No `matchedModifierId` without a unique candidate.
3. Mark detection is ID-confirmed; jewel `of the Abyss` never counts as Mark.
4. `existingDesecration` is `absent` only under the U-011/U-014 conditions above.
5. UI locale never affects parsing; non-EN text -> `UNSUPPORTED_CLIPBOARD_LOCALE`.
6. Grammar holds no entity names; every `confirmed` token appears in its named fixture.
7. A `TEST_ONLY` parser adapter can be registered without domain or UI-locale changes.

## Tests (`tests/parser/`)

- Stage unit tests; synthetic inputs use `TEST_ONLY_` pack entities and live in
  `tests/fixtures/clipboard/synthetic/` (never confirm grammar tokens).
- Verbatim EN fixture tests (SoT §18.2, §19.1) once captured; `ParsedItem` snapshots reviewed.
- Grammar purity + provenance tests.
- Ambiguity: two `TEST_ONLY` mods with identical stats -> unresolved, `possibleGroups` = union.
- Perturbation property test (line endings/whitespace).
- Registry: synthetic adapter registration; `auto` detection tie -> unsupported.

## Dependencies

002 (pack: `nameIndexEn`, `statTranslationsEn`, `abyssMarkModifierIds`, `specialItems`), 003
(registry conventions), 005 (shared code registry).

## Unresolved items

U-005, U-006 (special items), U-011 (markers), U-014 (regular-source revealed detection).
