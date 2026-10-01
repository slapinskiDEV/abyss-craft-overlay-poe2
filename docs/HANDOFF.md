# Handoff — where we stopped (2026-09-30)

Read this first when resuming. Authority remains `POE2_ABYSS_OVERLAY_SOURCE_OF_TRUTH.md` (v0.2.14).
Overview for a new contributor or agent: `docs/APP_CONTEXT_REPORT.md`.

## Done

- Specs 001–016 implemented (013, trade search link, planned only). Spec 017 (pre-video
  stabilization): every code item done; manual items open (below).
- **Open source (2026-09-30):** public repo `slapinskiDEV/abyss-craft-overlay-poe2`, MIT for the code,
  third-party terms in `NOTICE.txt` (RePoE data owned by GGG, poe2wiki excerpts CC BY-NC-SA 3.0),
  `CONTRIBUTING.md`, bilingual README with download hero. Fresh history; the old history stays in the
  private repo `abyss-craft-overlay-poe2-history`. Commits use the GitHub noreply address.
  Secret scanning, push protection, Dependabot alerts and security PRs are on.
- **Release process (spec 017 D1):** a push to `master` builds a test pre-release `build-<n>` in the
  source repo; a newer push cancels the running one. Players get a build only from
  `gh workflow run "Windows build" -f publish=true` (releases repo `…-releases`, README and issue
  forms synced, commit tagged `v<version>`). Version `0.4.<run number>`. Latest player release: v0.4.3.
- **App ID** `com.slapinskidev.poe2-abyss-overlay`, NSIS GUID pinned to the old ID's GUID so installs
  update in place.
- **Spec 017 code fixes:** normal-copy parse blow-up (C1), off-base exclusive → false `invalid` (C2),
  unidentified/mirrored fail closed (C3, SoT U-015), regex and Unrevealed slot fixes (C4, C5); tray,
  single instance, settings file errors, startup error dialog, renderer crash reload, taken hotkey
  warning, tray reset position (A1–A9); error boundary, stuck filters, pool names from the data pack
  (pack schema 2), startup/IPC errors, truncation note, coverage label (B1–B7); releases README hero
  and issue forms (D3, D4).
- 259 tests; `npm run verify:release` green.

## Open — next steps

1. **Clipboard fixtures (SoT §19.1, spec 017 F5) — gate for the video and for the item-specific
   pool.** Until they exist the exact item check is `unknown` (`EXISTING_DESECRATION_UNDETERMINED`,
   U-011/U-014) and the base pool is shown. When the maintainer provides them:
   - save each verbatim copy under `tests/fixtures/clipboard/en/<class>-<base>-<state>-<copyMode>.txt`
     with a `.meta.json` (copy mode, game version, date, sha256);
   - in `src/parser/en/grammar.ts` set each token proven by a fixture to
     `status: 'confirmed', fixture: '<file>'` (tests check the token occurs in that file);
   - fix any format differences the fixtures reveal (labels, advanced block header, markers);
   - set `U014_REGULAR_REVEAL_DETECTABLE` only if fixtures prove regular-source revealed
     Desecrated affixes stay detectable in both copy modes; update SoT §20 first.
   Players can send copies through the "Item copy for testing" issue form in the releases repo.
2. **Windows smoke test (spec 017 F1–F4)** — `tests/manual/overlay/CHECKLIST.md`, plus: one entry in
   "Installed apps" after updating to a build with the new app ID; holding `Alt+T` does not type `t`
   in the game; taken-hotkey warning; tray "Reset window position".
3. **Well of Souls validation** — `tests/manual/well-of-souls/TEMPLATE.md` (U-001, U-002, U-008,
   U-012, U-013, U-014, U-015, Putrefaction slot count). Results go into the SoT first, then rules data.
4. **Maintainer review:** 13 Mace/Staff rows with two Lich tags excluded from forced-Lich pools
   (`data-source/reports/2026-09-26-4.5.5.2/audit-report.json`); `specs/000-index.md` table
   "Choices made where the SoT is silent or internally inconsistent"; U-007 (fractured Mark).
5. **Before the video:** `npm run data:update` (pack is RePoE 4.5.5.2 / game 0.5.5), then one tagged
   player release that the video shows; no other release during recording (spec 017 D2, E1).
6. **Code signing:** unsigned for now; no paid signing (maintainer, 2026-09-30). **SignPath Foundation
   application sent 2026-09-30** (answers in `docs/signpath-application.md`), awaiting the reply,
   including whether the bundled GGG data pack is acceptable. If accepted, do the repository steps at
   the end of that file.
7. **Not now (maintainer decisions):** donation link, trade search link (spec 013) (2026-09-30);
   maximize/restore button in the title bar (2026-10-01; idea: □/❐ + double-click on the title,
   restore to the previous bounds, current monitor; needs SoT §16.3).
8. Every release: a changelog entry (`src/shared/changelog.ts` + `src/i18n/ui/{en,pl}/changelog.json`).

## Commands

`npm run typecheck` · `npm test` · `npm run dev` · `npm run data:update` · `npm run verify:release` ·
`npm run package:win` (Windows) · `gh workflow run "Windows build" -f publish=true` (player release)
