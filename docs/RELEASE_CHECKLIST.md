# Release checklist (spec 008)

1. `npm run verify:release` is green: validated production pack, translations, every test passed,
   **no skipped tests** (SoT §18.3 #28, §19.4).
2. Review `data-source/reports/<snapshot>/` (validation, audit, semantic diff) and approve changes
   to `tests/integration/golden/canonical-pools.json` by committing them.
3. Build on **Windows**: `npm run package:win` (NSIS installer + portable, x64, unsigned).
   - On Linux without Wine only the portable target builds:
     `npm run verify:release && npm run build && npm run package:scan && npx electron-builder --win portable`.
     The NSIS installer needs Windows or Wine.
4. Manual smoke on Windows 10/11 (`tests/manual/overlay/CHECKLIST.md`): start after SmartScreen
   bypass, hotkey toggle, clipboard read, Windowed Fullscreen, position restore.
5. GGG notice visible in the footer and About; `NOTICE.txt` present in the install directory.
6. Data manifest visible in About (game version, RePoE version, data pack date).
7. SoT §24 checklist reviewed in `tests/architecture/definition-of-done.md`.
8. Changelog updated; SoT changelog updated if a product decision changed.
