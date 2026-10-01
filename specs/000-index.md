# Specs index

**Parent document:** `POE2_ABYSS_OVERLAY_SOURCE_OF_TRUTH.md` (SoT) **v0.2.17**
**Spec set version:** 0.3.0 (draft, awaiting maintainer review — SoT §23)

The SoT is authoritative. Specs clarify implementation detail and record algorithm/design choices
under SoT §0.1. On any conflict the SoT wins and the spec must be corrected. There are no
maintainer-decision overrides of the SoT in this spec set.

## Spec list

| ID | File | Scope | Depends on |
|---|---|---|---|
| 001 | `001-app-shell-and-security.md` | Electron shell, IPC boundary, overlay window, settings, hotkey | 002, 003, 004 (locale registries), 005 (manifest summary, code registry) |
| 002 | `002-data-ingestion-and-normalization.md` | RePoE snapshot, provenance, classification, rule registry, validation gates, manifest | — |
| 003 | `003-localization.md` | EN/PL UI registry, EN game-term provider registry, independence of locale axes | 002, 005 (code registry, integration tests) |
| 004 | `004-clipboard-item-parser.md` | Parser-adapter registry, EN adapter, affix matching, Abyss state, confidence | 002, 003, 005 (code registry) |
| 005 | `005-desecration-rules-engine.md` | Pre-validation, branches, staged pools, floors, Lich force, Putrefaction, completeness | 002, 004 |
| 006 | `006-overlay-ui.md` | Data-driven controls, eligible/blocked/conditional views, branches, search | 001, 002, 003, 004, 005 |
| 007 | `007-testing-and-validation.md` | Test layers, TEST_ONLY policy, traceability, manual matrix, real-data gate | all |
| 008 | `008-packaging-and-data-update.md` | Windows build, bundled pack, data update, non-skippable release gate | 001, 002, 007 |
| 009 | `009-base-pool-and-overlay-refresh.md` | Base Desecration pool (SoT §14.7), hotkey clipboard refresh, Abyss UI | 001, 005, 006 |
| 010 | `010-auto-copy-hotkey.md` | Hotkey sends the game's copy shortcut once (SoT §3.1 exception) | 001, 009 |
| 011 | `011-app-update-and-release-notes.md` | In-app update from the public releases repo, release-notes dialog (SoT §3.5, §16.8) | 001, 008 |
| 012 | `012-three-column-workspace.md` | Three-column layout, free slots, item preview, usable Omens (SoT 0.2.9) | 005, 006, 010 |
| 013 | `013-trade-search-link.md` | **Planned, not implemented:** trade site search link (SoT §2.4) | 002, 011, 012 |
| 016 | `016-hotkey-latency.md` | Hotkey latency, loading state (SoT 0.2.13) | 010, 015 |
| 015 | `015-focus-and-hotkey.md` | Overlay keeps keyboard focus in the game; default hotkey Alt+T (SoT 0.2.12) | 010, 012 |
| 014 | `014-item-defaults.md` | Default Bone and side filter for a new item (SoT 0.2.11) | 009, 012 |
| 019 | `019-bone-omen-tooltips.md` | Bone/Omen tooltips: official description, PL unofficial summary from rules (SoT 0.2.16) | 002, 003, 006 |
| 018 | `018-title-bar-and-timings.md` | Title bar without an OS drag region; hotkey timings in the debug report | 001, 015, 016 |
| 017 | `017-pre-video-stabilization.md` | **Open:** stabilization and release process before the public video | 008, 010, 011, 015, 016 |

## Implementation order (SoT §23)

`002 -> 003 -> 004 -> 005 -> 001 -> 006 -> 007 -> 008`, then `009` (SoT 0.2.5), `010` (SoT 0.2.6) `011` (SoT 0.2.8) and `012` (SoT 0.2.9), `014` (SoT 0.2.11), `015` (SoT 0.2.12), `016` (SoT 0.2.13), all from maintainer feedback; `013` is planned only.

Each spec's own tests must be green before the next spec starts; 007 obligations are met
incrementally. The shared code registry `src/shared/diagnostic-codes.ts` (defined in 005) is
created with 002 and extended by each later spec, so earlier specs can reference it.

## Cross-cutting rules (SoT §0.2, §0.3, §5.10, §9.4, §18.3 #24–28)

1. **Zero invented game data.** Every production entity/fact is traceable to an accepted snapshot
   record (`sourceRefs`) or a `RuleEvidence` entry. Curated overrides name the exact canonical ID
   resolved from the snapshot.
2. **Fail closed.** Missing/contradictory/unresolvable data or undocumented interactions yield
   `unknown`, `unsupported`, `data_conflict` or `needs_manual_validation`. `invalid` is used only
   when the incompatibility itself is evidenced (SoT rule or evidence entry).
3. **Pool completeness is explicit.** A result is either a final blocker-aware pool, an explicitly
   non-final `base_eligibility_only` view, or no pool (`unknown`). Partial parses and U-items never
   produce a final pool (005 "Completeness").
4. **TEST_ONLY isolation.** Synthetic entities use `TEST_ONLY_` IDs/names, live under `tests/`,
   never mirror real IDs, and a validation gate proves none reach the production pack.
5. **Data-driven selectors.** Production UI lists of Bones, Omens, item classes and modifier
   categories come from the data pack/rule registry; no renderer catalog or fallback list.
6. **Independent locale axes.** UI locale, game-term locale and parser locale are separate
   registries; adding one requires none of the others and no domain change.
7. **Real-data release gate.** Snapshot-backed tests may skip in ordinary dev/CI, but the release
   workflow fails if the real validated pack is absent or any real-data test skipped.

## Unresolved-item register (SoT §20)

| ID | Status (SoT) | Topic | Handled in | Behavior |
|---|---|---|---|---|
| U-001 | ASSUMPTION_BLOCKED | Mark + opposite-side Necromancy Omen | 005 | `unknown`, no pool |
| U-002 | ASSUMPTION_BLOCKED | Altered Collarbone + Putrefaction | 005 | `unknown`, no pool |
| U-003 | working model | Mark floor rounding `floor(ilvl*0.40)` | 002, 005 | factor in evidenced rule entry; result cites U-003 |
| U-004 | unknown | Probabilities / weights | 005, 006 | never shown |
| U-005 | unsupported | Special unique / multi-Desecration | 002, 004, 005 | `unsupported` |
| U-006 | unsupported | Time-Lost Jewels | 002, 004, 005 | `unsupported` |
| U-007 | working model | Full-side removal / fractured corners | 005 | fractured non-removable; no removable affix -> `unsupported`; fractured Mark -> `unknown` |
| U-008 | ASSUMPTION_BLOCKED | Ancient floor + Mark floor | 005 | `unknown`, no pool |
| U-009 | DATA_DISCOVERY_REQUIRED | RePoE fields identifying exclusive categories | 002 | resolved autonomously from snapshot with recorded evidence; build fails closed until configured |
| U-011 | NEEDS_MANUAL_FIXTURE | EN clipboard markers (Desecrated/fractured) | 004 | markers unconfirmed until verbatim fixture |
| U-012 | ASSUMPTION_BLOCKED | Mixed open/full sides, no side Omen | 005 | `unknown`, no pool |
| U-013 | ASSUMPTION_BLOCKED | Empty forced-Lich fallback vs floors / non-forced exclusives | 005 | craft `valid_with_warning`; pool `unknown` whenever those details can affect it |
| U-014 | NEEDS_MANUAL_FIXTURE | Detectability of revealed regular-source Desecrated affix | 004, 005 | existing-Desecration state `undetermined` -> evaluation `unknown` |
| U-015 | NEEDS_MANUAL_VALIDATION | Unidentified and mirrored items (SoT 0.2.14) | 005, 017 | exact check `unknown` (`ITEM_STATE_UNDOCUMENTED`), slots undetermined, base pool unchanged |

U-015 was added to the SoT (0.2.14) from the spec 017 review; the specs introduce no U-item of their own.

## Expected MVP behavior to be aware of

- Until verbatim EN fixtures confirm the Desecrated/Unrevealed and fractured markers (U-011) and
  regular-source revealed detection (U-014), the exact item check of every real clipboard returns
  `unknown` (`EXISTING_DESECRATION_UNDETERMINED`). The overlay then shows the base Desecration
  pool (SoT §14.7, spec 009), which is never `final`. Capturing the SoT §19.1 fixtures is still on
  the critical path for the item-specific pool.
- 002 assumes Bones and Omens are records in RePoE `base_items.json`; if not, the build stops with
  `ENTITY_UNRESOLVED` and the spec must be revised with the observed location.

## Choices made where the SoT is silent or internally inconsistent (for maintainer review)

| SoT | Issue | Spec choice |
|---|---|---|
| §11.3/§14.5 vs U-013 | "documented regular fallback" vs `unknown` | 005: craft `valid_with_warning`, branch completeness `unknown` when floors or non-forced exclusives can matter |
| §12.2/§13.4 vs U-008 | Lich override of the Mark floor with an Ancient Bone | 005: `unknown` regardless of Lich Omen |
| §14.2 | status of `CONFLICTING_SIDE_OMENS` unspecified | 005: `unsupported` |
| §14.3 | fractured "unsupported/invalid" | 005: `unsupported` |
| §14.1 | "reject if parser insufficient" | 005: `unknown` (`PARSER_INSUFFICIENT`) |
| §14.1 vs U-014 | undetectable existing Desecration | 004/005: `undetermined` -> `unknown` |
| §5.5/§5.8 vs §0.2 rule 3 | example IDs `preserved_rib` without a generation rule | 002: keys derived from SoT names by a fixed rule |
| §11.5/§18.3 #20 vs §14.1 | Light hint needs a revealed mod, which already fails pre-validation | 005: hint keyed on revealed Desecrated only, shown with the invalid panel |
| U-014 | refers to `desecratedSource`, not an SoT field | 004: read as `sourceKind !== 'regular'` |
| §8, §5.6 vs §5.10 | literal locale unions vs no concrete locale list | 001/003/004: literals are MVP value sets; storage uses registry IDs |
| §11.1 vs §16.4 | Omen of Light phase "Annul" vs UI group "Recovery" | 002 `phase: 'annul'`; 006 labels the group Recovery |
| §5.7 vs §4.3; §0.1 | `locales/<locale>` vs `src/i18n/ui/<locale>`; `/docs/adr/` not in tree | 003 uses §4.3 path; ADRs go in spec sections or `docs/adr/` when needed |
| §13.2 vs §7.3/§7.10 | "more specific/left-most" vs first match in source order | 002/005 follow §7.10 (first match, source order) |
| §3.1 vs §15.3 | "reads only the clipboard" vs "Copy debug report" writes it | 001: `writeText` allowed only in the debug-report handler |
| §26 | header v0.2.4, changelog ends at 0.2.2; U-010 absent without a note | resolved in SoT 0.2.10 (noted in the changelog) | Spec-level design choices are recorded in each
spec's "Algorithm/design choice" section (SoT §0.1, §23).

## Common spec template (SoT §23)

Goal · In scope / Out of scope · Interfaces / contracts · Algorithm/design choice ·
Acceptance criteria · Tests · Dependencies · Unresolved items.
