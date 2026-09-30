# App context report — PoE2 Abyss Craft Overlay

Briefing for an agent that is new to this repository. Snapshot as of 2026-09-30 (app 0.4.x,
SoT v0.2.14). Open source since 2026-09-30: code MIT (`LICENSE`), third-party data terms in
`NOTICE.txt`, contributor rules in `CONTRIBUTING.md`. **Authority:** `POE2_ABYSS_OVERLAY_SOURCE_OF_TRUTH.md` (SoT). If
this report conflicts with the SoT, the SoT wins. Operational rules are summarised in `CLAUDE.md`.

---

## 1. What the app is

A **Windows desktop overlay for Path of Exile 2** (Electron + React + TypeScript), published under
the brand **slapinskiDEV**. It helps with **Abyss Desecration crafting**:

1. The player hovers an item in PoE2 and presses the hotkey (default **`Alt+T`**).
2. With `autoCopy` on (default) the overlay sends the game's advanced copy shortcut `Ctrl+Alt+C`
   **once**, then reads the Windows clipboard.
3. The EN clipboard text is parsed into language-independent IDs (base, class, item level, rarity,
   affixes, Abyss state).
4. The player picks an **Abyssal Bone** (only usable ones are listed) and **Omens**.
5. The rules engine shows which modifiers the craft can produce, which are blocked and why.

It answers "which modifiers are **eligible**", never "what you will get". **No probabilities**,
no price checks, no trade API, no crafting automation.

Required public notice: *"This product isn't affiliated with or endorsed by Grinding Gear Games in
any way."*

## 2. Hard constraints (do not break)

| Rule | Meaning |
|---|---|
| No invented game data | Items, bases, mods, tiers, tags, Bones, Omens come only from the versioned RePoE snapshot or evidenced rule entries with provenance. Never from model memory. |
| Fail closed | Missing/conflicting evidence → `unknown` / `unsupported` / `data_conflict` / `needs_manual_validation`. `invalid` only when the incompatibility itself is evidenced. |
| Runtime boundary | Flow is `PoE2 → clipboard → overlay`. No process/memory access, no game files, no OCR, no window inspection. Sole input exception: one `Ctrl+Alt+C` per hotkey press, only in `src/main/copy-shortcut.ts` (koffi → `keybd_event`). |
| Network | Only the update check against `github.com/slapinskiDEV/abyss-craft-overlay-poe2-releases` (`src/main/app-update.ts`). Data pack ships in the app, never updated at runtime. |
| Layering | `src/domain/` and `src/parser/` import nothing from Electron, React or i18next; they return IDs/reason codes, never localized strings. Guarded by `tests/architecture/`. |
| Data-driven UI | Bone/Omen/category options come from the pack only; no hard-coded catalog in the renderer (guard test). |
| TEST_ONLY isolation | Synthetic data is `TEST_ONLY_`-prefixed, lives under `tests/`, and never enters the pack. |
| Wording | A final item-specific result is "Eligible modifier pool"; the base pool is labelled as "possible modifiers for this base" with a note that current mods are ignored. |
| Change policy | Changing mechanics/scope/safety/localization/user-visible semantics requires an SoT change first, then spec, then code. |

## 3. Features (implemented)

**Core crafting logic**
- Bones: Gnawed / Preserved / Ancient Jawbone, Rib, Collarbone; Preserved Cranium (jewels);
  Altered Collarbone (Otherworldly pool); Preserved Vertebrae (waystone, legacy, hidden by default).
- Omens: Sinistral/Dextral Necromancy (side), Liege/Sovereign/Blackblooded (force Amanamu/Ulaman/
  Kurgal Lich pools; Jawbone/ordinary Collarbone only), Putrefaction (separate mode, regular sources,
  corrupts), Abyssal Echoes (reveal reroll, no pool change), Light (recovery hint).
- Filtering by base tags, side, item level, mod group, Ancient min-modifier-level floor (40, keep
  highest tier if a family would vanish), Mark of the Abyssal Lord, Lich force, Gnawed ilvl ≤ 64.
- **Base Desecration pool** (SoT §14.7, spec 009): pool for the base + Bone + Omens at the item
  level, ignoring current mods. This is what users see today, because the exact item check is still
  `unknown` (see §6).
- Branch-aware results for full items (removal outcomes; union view shows branch coverage `n/m`,
  never chances).
- Every excluded candidate carries a machine-readable reason code (`src/shared/diagnostic-codes.ts`).

**Overlay UI** (`src/renderer/features/`)
- Three-column workspace: craft controls (left), modifier list with filter chips (centre), item
  preview with free prefix/suffix slots and a Desecrated preview of a picked mod (right); stacks on
  narrow windows.
- Eligible/Blocked views; filters: search, prefix/suffix, regular/exclusive, Amanamu/Ulaman/Kurgal,
  Otherworldly, min/max required level.
- Defaults for a new item (spec 014): last Bone per target group, else the plain usable Bone; side
  filter preset when only one side has free slots.
- Onboarding, settings panel, diagnostics / "Copy debug report", release-notes dialog after update,
  Update button.
- Dark Abyss theme (app-owned CSS, no GGG artwork), app-drawn green diamond icon.

**Desktop shell** (`src/main/`)
- Frameless always-on-top window, remembered bounds, tray icon, global configurable hotkey.
- Hotkey behavior: new clipboard item → show it and stay open; same item → hide. `Escape` hides, ↻
  re-reads the clipboard. No clipboard polling.
- Window is non-focusable on Windows (spec 015) so the game keeps keyboard focus; focus is taken
  only while typing in a text field.
- Instant loading state on hotkey (spec 016); renderer background throttling disabled; key sequence
  ~50 ms.
- Robustness (spec 017): tray icon kept alive, second instance exits at once, settings file errors
  never crash, startup errors show a localized dialog, renderer crash reloads the window, a hotkey
  taken at launch opens the overlay with a warning, Reset window position also in the tray menu,
  workspace error boundary with a debug-report fallback.
- Settings (schema v4): UI locale, game-term locale, clipboard locale, hotkey, closeOnBlur, autoCopy,
  showLegacyCurrencies, showDataVersion, checkForUpdates, window bounds, onboarding, changelogSeen.
- In-app update via electron-updater (installer); portable build opens the download page.

**Localization**: UI in EN and PL (`src/i18n/ui/{en,pl}/*.json`); official PoE2 terms stay English
in both; EN clipboard only. UI locale, game-term locale and parser locale are independent registries.

## 4. Architecture map

```
src/
  main/        Electron main: main.ts, overlay-window, shortcuts, clipboard, copy-flow,
               copy-shortcut (only input sender), settings(+model, migration), app-update, tray
  preload/     window.overlayApi typed bridge (api-types.ts = IPC contract)
  renderer/    React UI: features/*.tsx, view-model/ (rows, workspace, debug-report), styles/theme.css
  domain/      pure TS engine: desecration/ (prevalidate, branches, pools, slots, options, evaluate),
               modifiers/ (spawn-weight, family-floor), diagnostics/
  parser/      registry + EN adapter (grammar.ts, adapter.ts) + common matchers
  data/        adapters/ (RePoE → normalized pack, classify, rules, validate), normalized/pack/pack.json,
               manifest/manifest.json
  i18n/        UI locale registry, game-term provider (bases, classes, Bones, Omens, mods, pool
               names), diagnostic formatting
  shared/      diagnostic-codes, ipc-channels, changelog entry IDs
data-source/   RePoE snapshots, wiki rule evidence, game-localization, reports (audit)
scripts/       data:fetch/evidence/normalize/validate/diff, verify-release, scan-artifact, icon, build version
specs/         000-index + 001–017 (013 planned only; 017 = pre-video stabilization)
tests/         architecture, data, domain, parser, i18n, integration (golden), main, renderer, manual
```

Engine entry point (plain TS, no Electron): `evaluateDesecration({ item, currency, activeOmens, data })`.

**Data pack** (`pack.json`, built from RePoE PoE2 **4.5.5.2**, target game version 0.5.5): 1849 base
items, 3373 modifiers, 30 item classes, 12 Bones, 8 Omens, 741 EN stat translations, affix limits,
mechanics constants, Abyss Mark mod IDs, special items, pool names (`poolNamesEn`), full provenance
with sha256 per source. Pack schema version 2.

## 5. Workflow and commands

- `npm run typecheck` · `npm test` (Vitest, 28 test files, ~260 tests) · `npm run dev` (electron-vite)
- `npm run data:update` — fetch RePoE + wiki evidence, normalize, validate, semantic diff
- `npm run data:validate` · `npm run i18n:validate`
- `npm run verify:release` — non-skippable gate (real validated pack, no skipped tests)
- `npm run package:win` — NSIS installer + portable exe (NSIS needs Windows/Wine)
- CI: `.github/workflows/windows-build.yml` on every push to `master` → release gate → build →
  test pre-release `build-<run>` (a newer push cancels the running test build). Players get a build only from
  `gh workflow run "Windows build" -f publish=true` (releases repo + tag `v<version>`, spec 017). App version =
  `<major>.<minor>` from `package.json` + CI run number as patch; bump the minor whenever the run
  counter could go backwards (new repo), or the updater will not offer the build.
- Every release needs a changelog entry: ID in `src/shared/changelog.ts` + texts in
  `src/i18n/ui/{en,pl}/changelog.json`.
- New behavior: SoT change (with changelog) → spec in `specs/` (template: Goal, In/Out of scope,
  Interfaces, Algorithm/design choice, Acceptance criteria, Tests, Dependencies, Unresolved items)
  → code + tests. Register open questions in `specs/000-index.md`.

## 6. Current limitations and open work

- **No verbatim EN clipboard fixtures yet** (`tests/fixtures/clipboard/en/` is empty; only one
  grammar token is `confirmed`). Therefore the exact item check returns `unknown`
  (`EXISTING_DESECRATION_UNDETERMINED`, U-011/U-014) and the overlay shows the base pool. Capturing
  fixtures (SoT §19.1) is on the critical path for the item-specific pool — see `docs/HANDOFF.md`.
- Blocked assumptions (return `unknown`, no pool): U-001, U-002, U-008, U-012, U-013; unidentified
  and mirrored items (U-015, exact check `unknown`, slots undetermined, base pool kept); see SoT §20
  and the register in `specs/000-index.md`. Special uniques and Time-Lost Jewels → `unsupported`.
- Pending manual work: Windows smoke test (`tests/manual/overlay/CHECKLIST.md`), Well of Souls
  validation (`tests/manual/well-of-souls/TEMPLATE.md`), review of 13 Mace/Staff rows with two Lich
  tags (`data-source/reports/2026-09-26-4.5.5.2/audit-report.json`).
- Trade search link (spec 013) is planned only; needs evidenced URL format/stat IDs and an SoT
  update before any code.
- Builds are unsigned (SmartScreen warning). Exclusive Fullscreen is not supported.
- Before the public video (spec 017): manual checks F1–F5 on Windows, `data:update` right before the
  video build, one tagged player release for the video. Donation link and trade link: not now.

## 7. Where to read next

1. `CLAUDE.md` (guardrails) → 2. `docs/HANDOFF.md` (status, next steps) → 3. `specs/000-index.md`
→ 4. relevant SoT section (§10 Bones, §11 Omens, §13–14 engine, §16 UI, §20 unknowns) → 5. the spec
for the area you touch.
