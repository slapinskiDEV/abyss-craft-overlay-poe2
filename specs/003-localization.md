# 003 — Localization

**SoT refs:** §5 (entire, incl. §5.7 extension contract, §5.10 independent axes), §6.4, §15, §18.3 #21–23, §18.4, §18.5

## Goal

Provide EN and PL UI text through i18next and official English game terminology through a
replaceable `GameLocalizationProvider`, as two **independent registries**. The parser-locale
registry (third axis) is defined in 004. No domain/rules-engine code depends on any locale list.

## In scope

- UI-locale registry, EN/PL resources, i18next setup, live switching.
- Game-term provider registry with the EN provider generated from the data pack.
- Settings resolution for `uiLocale` / `gameLocale` (SoT §5.6).
- Translation parity and entity-literal checks.

## Out of scope

- DE or other locales (SoT §5.9 — deferred; architecture only).
- Clipboard locale detection (004).
- Polish names of game entities — forbidden (SoT §5.4).

## Interfaces / contracts

### Axis 1 — UI locales (`src/i18n/ui/registry.ts`)

```ts
interface UiLocaleDefinition {           // SoT §5.7
  id: string;                            // 'en' | 'pl' in MVP
  label: string;                         // endonym shown in settings ("English", "Polski")
  resources: UiResources;                // namespaces below
}
export const UI_LOCALES: readonly UiLocaleDefinition[];  // [en, pl]
export type UiLocale = (typeof UI_LOCALES)[number]['id'];  // MVP values 'en' | 'pl' (SoT §5.1)

type UiNamespace = 'common' | 'workspace' | 'reasons' | 'settings' | 'onboarding' | 'about' | 'errors';
type UiResources = Record<UiNamespace, Record<string, unknown>>;   // nested i18next JSON
```

Resources: `src/i18n/ui/<locale>/{common,workspace,reasons,settings,onboarding,about,errors}.json`
(SoT §4.3 layout; SoT §5.7 writes `locales/<locale>/...` generically — same thing).

- Keys are semantic, never game names (SoT §5.5).
- `reasons.json` has `<CODE>.title` and `<CODE>.detail` for every code in the shared code
  registry `src/shared/diagnostic-codes.ts` (005 "Code registry": domain, parser, game-term and
  app/shell codes).
- Game entities appear in UI strings only as interpolation params (`{{omenName}}`), resolved by
  `formatDiagnostic(diag, t, gameTerms)` through the game-term provider.
- `about.gggNotice` translated; the EN SoT §3.3 wording is always also shown verbatim in About.

### Axis 2 — game-term locales (`src/i18n/game/providers/`)

```ts
interface GameLocalizationProvider {
  readonly locale: string;               // 'en' in MVP
  currencyName(id: string): LocalizedTerm;
  omenName(id: string): LocalizedTerm;
  baseItemName(id: string): LocalizedTerm;
  itemClassName(id: string): LocalizedTerm;
  modifierText(modId: string): LocalizedTerm;   // official text with value ranges; rendering
                                                // concrete rolled values is added with 004
}
interface LocalizedTerm { text: string; locale: string; fallback: boolean }

interface GameTermProviderDefinition {
  locale: string;
  create(pack: DataPack): GameLocalizationProvider;
}
export const GAME_TERM_PROVIDERS: readonly GameTermProviderDefinition[];  // [en]
```

- EN provider reads canonical names/stat translations from the pack (002); no hand-typed names.
- Contract for future providers: missing term -> EN text with `fallback: true` and diagnostic
  `GAME_TERM_FALLBACK_EN`; never machine translation (SoT §5.9).
- An unknown entity ID returns `{ text: <id>, fallback: true }` plus diagnostic
  `GAME_TERM_MISSING` — visible, never invented.

### Settings (SoT §5.6 exactly)

```ts
interface LocalizationSettings {
  uiLocale: 'en' | 'pl';
  gameLocale: 'en';
  clipboardLocale: 'auto' | 'en';
}
```

`resolveUiLocale(osLocale)`: `pl*` -> `pl`, otherwise `en`. `gameLocale` is `'en'`. The SoT §5.6
literal unions are the MVP value sets; stored settings are registry IDs validated at runtime, so
a future locale needs no migration code (SoT §5.10).

### Independence (SoT §5.10)

- A UI-only locale may be registered without a game-term provider or parser adapter; it shows EN
  game terms.
- A game-term provider may be registered without a UI locale.
- Neither registry is imported by `src/domain/**` or `src/parser/**` (except the parser importing
  its own registry, 004). No `if (language === ...)` in business code (SoT §5.7).

## Algorithm/design choice

Reference design adopted (SoT §5.7 interfaces). Clarifications: registries as `readonly` arrays of
definitions (simple, testable); provider `create(pack)` factory so providers are pure functions of
the data pack.

## Acceptance criteria

1. EN and PL resources have identical key schemas (allowlist file, empty by default).
2. Every reason/parser code has EN and PL `title`.
3. PL UI shows official EN game terms (SoT §18.3 #21).
4. PL resources contain no game-entity names as literal text (SoT §5.8).
5. Domain returns `{ code, params }` only; `Diagnostic` has no message field.
6. EN <-> PL switch is live and leaves the domain result unchanged (#22).
7. A synthetic `TEST_ONLY` UI locale and a synthetic `TEST_ONLY` game-term provider can each be
   registered alone without any change to `src/domain/**` (#23, SoT §5.10).

## Tests

- `scripts/validate-translations.ts` (+ Vitest wrapper): key parity, orphan keys, coverage of
  every code in `src/shared/diagnostic-codes.ts`, interpolation-variable parity.
- Entity-literal check: PL (and EN) resource values must not contain any canonical EN name of a
  pack currency, Omen, base item or item class (loaded from the real pack when present; in dev
  against `TEST_ONLY` fixture names to prove the check works).
- `resolveUiLocale` matrix.
- Registry independence tests (#23).
- Integration with 005: identical evaluation under EN and PL; replacing the provider with a
  `TEST_ONLY` provider leaves the domain result unchanged (SoT §18.4).

## Dependencies

002 (pack, EN terms), 005 (shared code registry; integration tests run once 005 exists).

## Unresolved items

None. DE deferred by SoT §5.9 (not an unresolved item).
