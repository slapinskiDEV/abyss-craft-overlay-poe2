# 006 — Overlay UI

> **Superseded in part by spec 009:** layout, theme, Bone selector (chip group) and the pool source
> switch (base pool / exact item) follow `009-base-pool-and-overlay-refresh.md`. Completeness rules
> below still apply to the exact item pool.

**SoT refs:** §0.2 rules 7–8, §1.3–1.4, §2.2, §9.4, §15.3, §16 (entire), §17, §22, §18.3 #24, #27, §18.5

## Goal

A compact React workspace that shows the parsed item, lets the user choose a Bone and Omens from
**data-pack-generated** options, and presents engine results per branch as Eligible /
Conditional / Blocked with reasons, filters and search. Completeness is always visible; a
non-final result is never labelled as the eligible modifier pool.

## In scope

- `src/renderer/features/`: workspace, craft-controls, result-summary, modifier-view,
  branch-selector, settings, about, onboarding, debug-report.
- View-model selectors mapping `ParsedItemResult` + `DesecrationEvaluation` to rows.
- Dark neutral theme, draggable header, ≈ 560 px default width.

## Out of scope

- Domain logic in components (SoT §0 rule 3): components call only view-model selectors and the
  engine helpers `boneOptions`, `omenOptions`, `evaluateDesecration`.
- Any hand-written list of PoE2 entities in renderer code (SoT §0.2 rule 7, §16.4).
- Price, trade, probability displays.

## Interfaces / contracts

### State (React context + reducer, SoT §4.1)

```ts
interface WorkspaceState {
  snapshot: ClipboardSnapshot | null;
  parse: ParsedItemResult | null;
  boneId: string | null;              // from boneOptions()
  omenIds: string[];                  // from omenOptions()
  evaluation: DesecrationEvaluation | null;
  selectedBranchId: string | 'union';
  view: 'eligible' | 'conditional' | 'blocked';
  filters: ModifierFilters;
}
interface ModifierFilters {
  text: string;
  sides: AffixSide[];
  categories: ModifierCategoryId[];   // derived from pack sourceKind/lichPool/specialPools
  minLevel?: number; maxLevel?: number;
  showBaseIneligible: boolean;        // default false
}

// Category = one filter chip, computed from pack data (never a literal list in renderer code):
// `regular`, `exclusive`, each LichPool value present in the pack, each SpecialPool present.
type ModifierCategoryId =
  | 'regular' | 'exclusive'
  | `lich:${LichPool}`
  | `special:${SpecialPool}`;
```

### Data-driven controls (SoT §0.2 rule 7, §18.3 #27)

- Bone dropdown = `boneOptions(item, pack, { includeLegacy: settings.showLegacyCurrencies })`;
  label via `GameLocalizationProvider.currencyName(id)`. Legacy entries (`releaseState`) carry the
  `drop-disabled/legacy` badge (SoT §2.2).
- Omen toggles = `omenOptions(...)`, grouped by `phase` from the pack (Desecrate / Reveal /
  Recovery); disabled options show their localized reasons.
- Mutually exclusive toggles and the Putrefaction panel are driven by `effect.kind`
  (`force_side`, `force_lich`, `putrefaction`, …) from the pack — never by comparing entity IDs
  or names in renderer code.
- Source/category filter chips are generated from the categories present in the pack.
- If the pack failed to load (001), no controls render — only the blocking error.

### Layout (SoT §16.4)

```text
┌ Header (drag) ────────────────────────────────────── [⚙] [×] ┐
│ <item name> · <base> · <rarity> · ilvl N · <item class>      │
│ [Parser: Full|Partial|Insufficient] [Data <version> · <date>]│
├ Craft controls ──────────────────────────────────────────────┤
│ Bone: [options from pack]  (☐ show incompatible/legacy)      │
│ Omens  Desecrate: [..from pack..]  Reveal: [..]  Recovery: [..]│
├ Result ──────────────────────────────────────────────────────┤
│ ● <status> — <branches> · <completeness badge> · <count>     │
│ ⚠ <warnings>                                                  │
├ Modifiers ───────────────────────────────────────────────────┤
│ Branch: [..][..][Union]                                      │
│ [<pool tab> N] [Conditional N] [Blocked N]  search [____]    │
│ Side / category chips / level range                          │
│ row: <official EN mod text> · side · L<n> · [category] · k/n · (reason) │
├ Footer ──────────────────────────────────────────────────────┤
│ Not affiliated with GGG · [Copy debug report]                 │
└──────────────────────────────────────────────────────────────┘
```

(Mockups may show real names for illustration; component code may not contain them.)

### Completeness presentation (SoT §9.4, §18.3 #24–25)

| Engine state | UI |
|---|---|
| status `invalid` / `unsupported` / `unknown` | reason panel only; no modifier lists |
| branch `completeness: 'final'` | heading **"Eligible modifier pool"** (SoT §1.4) |
| branch `completeness: 'base_eligibility_only'` | heading **"Base eligibility (not final)"** + persistent banner "Some existing modifiers could not be identified; blocking may be incomplete"; Conditional tab highlighted |
| branch `completeness: 'unknown'` (e.g. U-013) | craft status shown; pool area shows SoT §22.3 message, no list |

The "Eligible modifier pool" heading, the "Eligible" tab label and the "N eligible" count are
rendered **only** for `final` branches. For `base_eligibility_only` the same slots read
"Base eligibility (not final)" / "N base-eligible"; for `unknown` the tab and count are hidden.
Union view over mixed completeness shows the weakest completeness.

### Reveal, recovery and Putrefaction panels (SoT §2.2, §11.4–11.6)

- **Reveal info** (always under the result summary): "Reveal offers {{optionCount}} options" and,
  when `reveal.rerollsAvailable > 0`, "Reroll available ×{{n}}" — values from the evaluation,
  never literals; the pool itself is unchanged.
- **Recovery hint** (`recoveryHints`): a callout naming the Omen and currency through the
  game-term provider (e.g. "{{omenName}} + {{currencyName}} removes only the Desecrated
  modifier"). Shown with the invalid-state reason panel when the item is already Desecrated.
- **Putrefaction panel** (`mode: 'putrefaction'`): replaces existing modifiers; "up to
  {{maxUnrevealed}} Unrevealed modifiers" (working model, U-007 badge); fractured modifiers kept
  ({{fracturedKept}}); item becomes corrupted; regular-only prefix/suffix pools as two branches;
  Ancient-floor warning when present. No six-mod combinations.

### Branches (SoT §16.5)

One tab per branch (removed affix text / "Open prefix slot" / "Mark replaced"). Union shows
coverage `k/n` with a persistent "branch coverage, not a probability" caption. Never merge
silently.

### Rows

- Text from `GameLocalizationProvider.modifierText` (official EN for EN and PL UI).
- Tiers grouped by `tierFamilyId`; blocked/conditional rows show all reasons (first inline,
  rest in tooltip); rows can reveal provenance IDs in a details popover (SoT §0.2 rule 8).
- Virtualized above 200 rows.

### Search (SoT §16.6)

Matches official EN text; shows eligible/conditional/blocked, branches, category and reasons;
includes `BASE_TAG_NOT_ELIGIBLE` and `SOURCE_NOT_ENABLED` rows so "why can't I get X?" is
answered.

### Messages

- `NOT_A_POE2_ITEM` / `UNSUPPORTED_CLIPBOARD_LOCALE`: concise instruction (English client needed
  in MVP) + "Read clipboard again".
- Unknown: SoT §22.3 wording. Stale data: SoT §22.2 banner.
- No `%`, "chance", "likely" or equivalents in any UI string (007 lint).

### Settings (SoT §16.7)

UI language (from UI registry), game terminology language and clipboard locale (options from
their registries — a single option each in MVP), hotkey, close on blur, show legacy currencies,
data version display, reset window position, About (GGG notice, manifest sources, RePoE
version).

### Debug report (SoT §15.3)

JSON: app version, manifest summary (`dataPackId`, RePoE version), parser locale/confidence,
base ID, Bone/Omen IDs, reason codes with `uRef`, branch count and completeness, provenance IDs of
fired rules. Raw clipboard only with an explicit checkbox (default off).

## Algorithm/design choice

Reference design. Clarification: a third "Conditional" list reflects 005's conditional bucket;
UI behavior switches on `effect.kind` rather than entity IDs to keep renderer code free of
entity catalogs.

## Acceptance criteria

1. Non-final results never show the "Eligible modifier pool" heading (SoT §18.3 #24).
2. `invalid`/`unsupported`/`unknown` never render a modifier list.
3. Branch selection changes the visible pool.
4. Every blocked/conditional row shows a reason.
5. All selectable entity options come from the pack; renderer source contains no entity catalog
   (SoT §18.3 #27).
6. EN <-> PL switching is live; game terms stay EN.
7. No probability wording.
8. Usable at 520–620 px and 100/125/150 % DPI.

## Tests (`tests/renderer/`, RTL + jsdom, TEST_ONLY pack)

- Selectors: filters, search, union coverage, completeness propagation.
- Components: heading switch per completeness, reason panel for invalid/unknown, disabled-option
  reasons, exclusive toggles by `effect.kind`, branch switch, stale banner, debug report raw-text
  opt-in, pack-load failure screen.
- Catalog guard (architecture): renderer source must not contain any `TEST_ONLY_` pack name/ID
  literal nor, when the real pack is present, any real pack entity name/ID literal.
- Language switch without workspace remount.

## Dependencies

001 (overlayApi), 002 (pack types), 003 (i18n, providers), 004 (`ParsedItemResult`), 005 (engine,
helpers, codes).

## Unresolved items

U-001, U-002, U-008, U-012, U-013, U-014 surface as reason panels / unknown pool areas; U-004 —
no probability UI.
