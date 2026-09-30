# Handoff — where we stopped (2026-09-27)

Read this first when resuming. Authority remains `POE2_ABYSS_OVERLAY_SOURCE_OF_TRUTH.md` (v0.2.10).

## Done

- Specs 000–008 written, reviewed for SoT consistency and committed.
- All specs implemented in order `002 → 003 → 004 → 005 → 001 → 006 → 007 → 008`:
  data pack from RePoE 4.5.5.2 + wiki evidence, EN/PL localization, EN clipboard parser,
  Desecration engine, Electron shell, React overlay, test layers + release gate, packaging.
- 215 tests green; `npm run verify:release` green (no skipped tests).
- Dev mode (`npm run dev`) shows the overlay immediately; packaged builds start hidden
  (hotkey `Ctrl+Shift+D` or tray icon).
- GitHub Actions workflow `.github/workflows/windows-build.yml` builds the Windows NSIS installer
  and portable exe on every push to `master` and publishes them as GitHub Release `build-<run number>`
  (also as artifact `poe2-abyss-overlay-windows`, 14 days).

- **Spec 009 (after the first Windows test, SoT 0.2.5):** base Desecration pool (SoT §14.7) shown
  for real items while the exact item check stays `unknown`; the hotkey re-reads the clipboard when
  the overlay is open and a new item was copied; `Escape` hides; ↻ re-reads; Abyss-themed UI
  with chip selectors; the Bone choice is remembered per item type.

- **Spec 010 (SoT 0.2.6):** `Ctrl+Shift+D` sends `Ctrl+Alt+C` once and shows the copied item.
  After the first Windows test (item not copied) the events carry scan codes and 15 ms spacing.

- **SoT 0.2.7:** simpler layout (no `unknown` exact-check line next to the base pool), green
  diamond app icon (`src/main/app-icon.ts`, `npm run icon`).
- **Spec 011 (SoT 0.2.8):** in-app update from the public repo
  `slapinskiDEV/abyss-craft-overlay-poe2-releases`, release-notes dialog (EN/PL,
  `src/shared/changelog.ts` + `src/i18n/ui/<locale>/changelog.json`), only usable Bones listed.
  CI syncs `docs/releases-repo/README.md` there. **Every release: add a changelog entry.**

- **Spec 012 (SoT 0.2.9):** three-column workspace, free slots, item preview, usable Omens only,
  hotkey works right after clicking the overlay. Public releases repo live (first release v0.3.12).
- **Spec 013:** trade search link, planned only (SoT §2.4); see its "To verify" list.

## Open — next steps

1. **Windows test of the latest build** (`tests/manual/overlay/CHECKLIST.md`): auto-copy, hotkey
   right after clicking the overlay, three-column layout, free slots, update from one release to the
   next, release-notes dialog.
2. **Verbatim EN clipboard fixtures (SoT §19.1) — needed for the item-specific pool.** Until they
   exist the exact item check is `unknown` (`EXISTING_DESECRATION_UNDETERMINED`, U-011/U-014); the
   base pool is shown instead.
   When the maintainer provides them:
   - save each verbatim copy under `tests/fixtures/clipboard/en/<class>-<base>-<state>-<copyMode>.txt`
     with a `.meta.json` (copy mode, game version, date, sha256);
   - in `src/parser/en/grammar.ts` set each token proven by a fixture to
     `status: 'confirmed', fixture: '<file>'` (tests check the token occurs in that file);
   - fix any format differences the fixtures reveal (labels, advanced block header, markers);
   - set `U014_REGULAR_REVEAL_DETECTABLE` only if fixtures prove regular-source revealed
     Desecrated affixes stay detectable in both copy modes; update SoT §20 first.
3. **Windows smoke test** — `tests/manual/overlay/CHECKLIST.md` (Windowed Fullscreen, DPI,
   monitors, hotkey conflicts, SmartScreen bypass).
4. **Well of Souls validation** — `tests/manual/well-of-souls/TEMPLATE.md` (U-001, U-002, U-008,
   U-012, U-013, U-014, Putrefaction slot count). Results go into the SoT first, then rules data.
5. **Maintainer review items**
   - `data-source/reports/2026-09-26-4.5.5.2/audit-report.json`: 13 Mace/Staff rows with two
     Lich tags are excluded from forced-Lich pools until reviewed.
   - `specs/000-index.md` table "Choices made where the SoT is silent or internally inconsistent".
   - Wiki (Essence of the Abyss) claims a fractured Mark causes another modifier to be replaced;
     SoT has not adopted it, engine returns `unknown` (U-007).
6. NSIS installer cannot be built on Linux without Wine; Linux builds only the portable exe.
7. Add the YouTube link to `docs/releases-repo/README.md` when the video exists (CI syncs it).
8. Trade search link (spec 013): only after its "To verify" list is done and the SoT updated.

## Commands

`npm run typecheck` · `npm test` · `npm run dev` · `npm run data:update` · `npm run verify:release` ·
`npm run package:win` (Windows)
