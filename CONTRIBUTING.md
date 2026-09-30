# Contributing

Thanks for helping. This project has a few rules that are stricter than usual, because plausible
but wrong crafting data is its main failure mode.

## Before you change anything

1. Read [`CLAUDE.md`](CLAUDE.md) (short list of guardrails) and the relevant section of the
   [Source of Truth](POE2_ABYSS_OVERLAY_SOURCE_OF_TRUTH.md) (SoT). If a spec or the code conflicts
   with the SoT, the SoT wins.
2. A change to a mechanic, scope, safety rule, localization policy or user-visible behavior starts
   with an SoT change (with a changelog entry), then a spec in [`specs/`](specs/000-index.md), then
   code and tests.

## Hard rules

- **No invented game data.** Items, bases, modifiers, tiers, tags, Bones, Omens and their rules
  come from the versioned RePoE snapshot or from rule entries with evidence references and an
  evidence level — never from memory.
- **Fail closed.** When evidence is missing or conflicting, return `unknown`, `unsupported`,
  `data_conflict` or `needs_manual_validation`. Use `invalid` only when the incompatibility is
  evidenced.
- **No probabilities.** Candidate counts and branch coverage are never turned into chances.
- **Runtime boundary.** No game process/memory access, no game files, no screen reading, no
  additional input to the game, no new network access.
- **Layering.** `src/domain/` and `src/parser/` import nothing from Electron, React or i18next and
  return IDs and reason codes, not text.
- **Test data** is `TEST_ONLY_`-prefixed and lives under `tests/`.
- UI text goes into both `src/i18n/ui/en` and `src/i18n/ui/pl`; official PoE2 terms stay English.

## Checks

```sh
npm run typecheck
npm test
npm run i18n:validate
npm run data:validate   # when you touch data-source/ or src/data/
```

Pull requests need a green typecheck and test run. User-visible changes need a release-notes
entry (`src/shared/changelog.ts` + `src/i18n/ui/{en,pl}/changelog.json`).

## Clipboard fixtures (most wanted)

The item-specific pool is blocked until real EN clipboard copies confirm the Desecrated,
Unrevealed and fractured markers (SoT §19.1). To contribute one, copy an item in game with
`Ctrl+Alt+C` (and, if possible, `Ctrl+C`), and open an issue or PR with the verbatim text, the copy
mode, the game version and the date. Naming: `tests/fixtures/clipboard/en/<class>-<base>-<state>-<copyMode>.txt`.

## Bug reports

Open an issue and attach the debug report (overlay footer → "Copy debug report") when possible.

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
