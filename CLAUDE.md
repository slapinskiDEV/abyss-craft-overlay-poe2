# CLAUDE.md

Derived operational summary of `POE2_ABYSS_OVERLAY_SOURCE_OF_TRUTH.md` (SoT, v0.2.15).
This file is not a second source of truth: **if it conflicts with the SoT, the SoT wins.**

## Guardrails (SoT §23.1)

1. Read the SoT before material implementation changes. Specs (`specs/`) and code must not contradict it.
2. Never invent PoE2 data or mechanics — no items, bases, currencies, Omens, modifiers, tiers,
   tags, levels, weights, compatibility rules or names from memory. Production game data comes
   from the versioned RePoE snapshot or evidenced rule entries, with provenance.
3. Fail closed: missing/conflicting evidence -> `unknown`, `unsupported`, `data_conflict` or
   `needs_manual_validation`. `invalid` only when the incompatibility itself is evidenced.
4. Test-only data is `TEST_ONLY_`-namespaced, lives under `tests/`, and can never enter the pack.
5. Curated overrides and hand-encoded rules carry evidence refs and an evidence level.
6. No runtime interaction with PoE2: no process/memory access, no game-file parsing, no input
   injection, no screen automation. Runtime path: user clipboard -> overlay. Sole exception
   (SoT §3.1): with `autoCopy` on, the hotkey sends `Ctrl+Alt+C` once, from `src/main/copy-shortcut.ts`.
7. Domain returns IDs, reason codes, params and structured outcomes — never localized strings.
   `src/domain/` and `src/parser/` import nothing from Electron, React or i18next.
8. MVP localization is EN + PL UI; official PoE2 terms stay English in both; EN clipboard only.
   UI locale, game-term locale and parser locale are independent registries.
9. No probabilities; never turn candidate counts or branch coverage into chances.
10. Every excluded candidate has a machine-readable reason.
11. Algorithms are flexible, semantics are not: a better algorithm is allowed if justified,
    documented (spec "Algorithm/design choice" or `docs/adr/`) and verified by tests.
12. Changing a mechanic, scope, safety rule, localization policy or user-visible semantics
    requires an SoT change, not a silent deviation.
13. Specs before implementation; order `002 -> 003 -> 004 -> 005 -> 001 -> 006 -> 007 -> 008`.
14. Deterministic, auditable data transformations with validation gates.

## Project conventions

- Partial parses and U-items never yield a final "Eligible modifier pool" (`completeness`).
- The base Desecration pool (SoT §14.7, spec 009) ignores item state and is never `final`; the
  exact item check stays fail-closed.
- Production UI options (Bones, Omens, categories) come from the data pack only.
- Release requires `npm run verify:release` (real validated pack, no skipped tests).
- Open questions: SoT §20 (U-001–U-009, U-011–U-015); register in `specs/000-index.md`.

## Commands

- `npm run typecheck` · `npm test` · `npm run dev`
- `npm run data:update` (fetch, evidence, normalize, validate, diff) · `npm run data:validate`
- `npm run i18n:validate` · `npm run verify:release` · `npm run package:win`
