# 007 — Testing and validation

**SoT refs:** §0.2 rule 9, §18 (entire), §19 (manual validation, incl. §19.4 release gate), §20, §24

## Goal

Define test layers, the TEST_ONLY policy, traceability of every SoT §18.3 case and §24 bullet,
the manual in-game matrix, and the split between skippable dev/CI real-data tests and the
**non-skippable** release gate.

## In scope

- Test layout, tooling, fixture rules, TEST_ONLY isolation.
- Traceability matrix.
- Manual record format and matrix.
- Regression workflow; `verify:release` gate definition (run by 008).

## Out of scope

- Automated Windows E2E (manual smoke for MVP).

## Interfaces / contracts

### Layout

```text
tests/
  architecture/   # domain purity, runtime boundary, catalog guard, no-probability wording
  data/  i18n/  parser/  domain/  renderer/  integration/
  fixtures/
    clipboard/en/          # VERBATIM EN captures only (+ .meta.json with sha256)
    clipboard/annotated/   # annotated copies
    clipboard/synthetic/   # TEST_ONLY, clearly non-verbatim
    data/test-only-pack.ts # TEST_ONLY normalized pack
  manual/
    well-of-souls/<date>-<case>.md
    overlay/<date>.md
```

### TEST_ONLY policy (SoT §0.2 rule 9, §18.1, §18.3 #26)

- Every synthetic entity ID and name starts with `TEST_ONLY_` and is named by role
  (`TEST_ONLY_BONE_ARMOUR_PLAIN`), never after a real entity (no `TEST_ONLY_PRESERVED_RIB`); no
  synthetic entity imitates a real ID shape (e.g. no fake `Metadata/Items/...` paths).
- Synthetic data lives only under `tests/`.
- Gates: 002 validation rejects `TEST_ONLY` in the pack; an architecture test fails if anything
  under `src/` imports from `tests/`; the build config excludes `tests/`.

### Real-data tests and the release gate (SoT §18.3 #28, §19.4)

- Real-data suites use `describeRealData(...)`. Normal behavior: skip with a visible notice when
  no snapshot/pack is present.
- With `REQUIRE_REAL_DATA=1`, `describeRealData` **fails** instead of skipping, and a Vitest
  reporter hook fails the run if any test was skipped.
- Real-data inputs are committed: the accepted RePoE snapshot under `data-source/snapshots/`
  (002) and the generated pack. The gate never downloads; a missing snapshot fails it.
- `npm run verify:release` = `data:validate` (on the committed production pack; requires
  `manifest.validated === true` and matching `dataPackId`) + `REQUIRE_REAL_DATA=1 vitest run`
  + translation validation + traceability check. 008 makes packaging depend on it.

### Fixture rules (SoT §19.1)

Verbatim files saved exactly as copied; `.meta.json` records copy mode, game version, capture
date, sha256; a test fails if the file hash drifts. Only verbatim fixtures can confirm parser
grammar tokens (004). Naming `<class>-<base>-<state>-<copyMode>.txt`. Cross-locale equivalence
fixtures are added only when a future parser locale is implemented (SoT §18.2).

### Traceability

| SoT | Test |
|---|---|
| §18.1 | `tests/data/*.test.ts` |
| §18.2 | `tests/parser/fixtures.test.ts` (verbatim EN) |
| §18.3 #1–20, #24, #25 | `tests/domain/sot-18-3.test.ts` (TEST_ONLY) + `tests/domain/sot-18-3.real.test.ts` (#1–20, real pack) |
| §18.3 #21–23 | `tests/i18n/*.test.ts` |
| §18.3 #24 (UI side) | `tests/renderer/completeness.test.tsx` |
| §18.3 #26 | `tests/data/validate-pack.test.ts` (TEST_ONLY gate), `tests/architecture/no-tests-import.test.ts` |
| §18.3 #27 | `tests/architecture/renderer-catalog-guard.test.ts` |
| §18.3 #28 | `tests/architecture/release-gate.test.ts` (gate verdict fails on skipped/failed/no tests) + `describeRealData` failing under `REQUIRE_REAL_DATA=1` |
| §18.4 | `tests/integration/pipeline.test.ts` |
| §18.5 | `tests/renderer/*.test.tsx` |
| §18.6 | `tests/manual/overlay/CHECKLIST.md` |
| §3.1 | `tests/architecture/runtime-boundary.test.ts` |
| §4.2 | `tests/architecture/domain-boundary.test.ts` |
| §17 | `tests/i18n/translations.test.ts` via `checkTranslations` (EN/PL resources) |
| §24 | `tests/architecture/definition-of-done.md` (bullet -> test or manual record) |

A traceability test checks every row's file exists and every `SoT 18.3 #n` title is present.

### Manual validation matrix (SoT §19.2)

All SoT §19.2 bullets, including U-012 (mixed open/full sides without side Omen) and U-014
(regular-source revealed Desecrated marker), plus: U-008 (Ancient Bone on a Mark item), U-013
(Lich Omen with empty forced pool on an item with natural exclusive options), U-011 marker capture
(normal + advanced), and Putrefaction slot count on a fractured and a non-fractured item (confirms
the `maxUnrevealed` working model, 005). Record format:

```markdown
# WOS-<n>: <case>
- Date / game version / client language:
- Item before (fixture file):
- Currency / Omen(s):
- Game error (verbatim):
- Item after (fixture file):
- Well of Souls choices (verbatim):
- Resolves: U-xxx? conclusion
- Evidence level: MANUAL_CONFIRMED
```

Resolving a U-item: SoT update (§20 + changelog) -> evidence entry + rule update -> tests.
SoT first.

### Regression workflow

`data:update` -> validation -> real-data suites -> semantic diff -> golden files
(`tests/integration/golden/*.json`, eligible IDs per canonical fixture) re-approved by commit.

## Algorithm/design choice

Reference design. Clarification: the skip-vs-fail switch (`REQUIRE_REAL_DATA`) keeps dev CI
network-free while making the release gate non-skippable, as SoT §19.4 requires.

## Acceptance criteria

1. Every SoT §18.3 case and §24 bullet is traceable.
2. `npm test` runs offline without a snapshot.
3. `verify:release` fails with no/unvalidated pack or any skipped test.
4. No TEST_ONLY entity is reachable from production code or the pack.

## Tests

Traceability test; release-gate self-test (#28); fixture hash test.

## Dependencies

All specs.

## Unresolved items

Manual matrix covers U-001, U-002, U-007, U-008, U-011, U-012, U-013, U-014; U-003 needs primary
evidence or an ilvl sweep; U-009 is resolved in 002 from the snapshot.
