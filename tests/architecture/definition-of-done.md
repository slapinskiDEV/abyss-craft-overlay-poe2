# SoT §24 Definition of done — traceability

| SoT §24 bullet | Evidence |
|---|---|
| Real EN clipboard item parses | `tests/parser/fixtures` (pending verbatim fixtures, SoT §19.1) |
| Ornate Plate + Preserved Rib produces a verified eligible pool | `tests/domain/sot-18-3.real.test.ts`, `tests/integration/golden/canonical-pools.json`; end-to-end pending U-011/U-014 fixtures |
| Side Omens constrain branches | `tests/domain/sot-18-3.test.ts` #3, #4 |
| Lich Omen compatibility enforced | `tests/domain/sot-18-3.test.ts` #2, #10; real #2 |
| Natural Lich mods stay in non-Lich pools | `tests/domain/sot-18-3.test.ts` (natural Lich case); real §21.3 |
| Existing mod groups affect eligibility | #15 |
| Full-side items create branches | #4, #16 |
| Ancient floor has automated tests | #17, `tests/domain/family-floor.test.ts` |
| Altered Collarbone Otherworldly eligibility | #11; real #11 |
| Putrefaction separate mode | #18 |
| EN/PL UI complete | `tests/i18n/translations.test.ts` |
| PL uses official EN game terms | `tests/i18n/locales.test.ts`, `tests/renderer/app.test.tsx` |
| Future DE without domain changes | `tests/i18n/locales.test.ts` (TEST_ONLY locale), parser registry test |
| No hardcoded localized business messages | `tests/architecture/domain-boundary.test.ts`, `Diagnostic` has no message field |
| Overlay works in Windowed Fullscreen | manual: `tests/manual/overlay/CHECKLIST.md` |
| No runtime game process/file access | `tests/architecture/runtime-boundary.test.ts` |
| No input injected into PoE2 | `tests/architecture/runtime-boundary.test.ts` |
| GGG notice included | `tests/renderer/app.test.tsx` |
| Data manifest visible | Settings/About panel, header badge (`src/renderer/features`) |
| Unknown interactions visibly unknown | #25, `tests/renderer/app.test.tsx` |
