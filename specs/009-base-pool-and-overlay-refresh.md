# 009 — Base Desecration pool, clipboard refresh and Abyss UI

**SoT refs:** §1.3–1.4, §14.4–14.7, §16.1–16.4, §18.3 #24–25, §22.3, §26 (0.2.5)

## Goal

Fix the three findings from the first Windows test (maintainer, 2026-09-27):

1. **Every real item showed `unknown` and no list**, even a plain Rare Bow with a Preserved Jawbone.
   The engine only answered "what can Desecration do to this *exact* item state?". That needs the
   Desecrated/fractured markers (U-011) and the regular-reveal detectability (U-014) to be confirmed,
   so without verbatim fixtures it always failed closed. The maintainer wants the question
   "which modifiers can I get on this item (base)?" answered. The new base pool (SoT §14.7)
   answers it. The exact item check stays fail-closed.
2. **The previous item stayed on screen.** The hotkey only toggled visibility, so with the overlay
   open the next `Ctrl+Shift+D` hid it without reading the clipboard.
   In development the first snapshot could also arrive before the renderer had subscribed.
3. **The UI looked like a debug form.** It needs a simpler, modern, Abyss-themed layout.

## In scope

- Domain: `DesecrationEvaluation.basePool` (SoT §14.7) and the pre-validation split it needs.
- Main/preload: hotkey refresh while visible, cached last snapshot, `getLastSnapshot` IPC.
- Renderer: new layout and theme, chip selectors, a pool source switch (base pool / exact item),
  collapsible details, `Escape` to hide, a read-clipboard button, a remembered Bone per target group.
- EN/PL strings for all new UI text.

## Out of scope

- Confirming U-011/U-014 (still needs verbatim fixtures, SoT §19.1). Until then the exact item
  check stays `unknown` for real items. The base pool is what the user reads.
- Probabilities, weights, predictions of the three reveal options (SoT §17).
- Clipboard polling (SoT §16.2). Every read is still triggered by the user.

## Interfaces / contracts

### Domain (`src/domain/desecration/types.ts`)

```ts
type BranchKind = 'mark_replacement' | 'open_slot' | 'removal' | 'putrefaction' | 'base';

interface BasePoolResult {
  status: EvaluationStatus;           // aggregate of the base-scope checks + side diagnostics
  reasons: Diagnostic[];
  sides: DesecrationBranchResult[];   // kind 'base'; empty unless status is valid/valid_with_warning
}

interface DesecrationEvaluation {
  // ...existing fields unchanged (the exact item check)...
  basePool: BasePoolResult;
}
```

- Each side result has `completeness: 'base_eligibility_only'`, or `unknown` when a U-item such as
  U-013 applies. `completenessReasons` always contains `BASE_POOL_ONLY` (new info code,
  domain layer). A base side is never `final`.
- `preValidate(ctx, confidence, scope)`, where `scope: 'item' | 'base'`. The `base` scope skips only
  the checks for undetermined item state:
  `EXISTING_DESECRATION_UNDETERMINED`, `AFFIX_LIMIT_UNKNOWN`, `AFFIX_CAPACITY_UNDETERMINED`,
  `MARK_STATE_UNDETERMINED`, `PARSER_PARTIAL_MOD_GROUPS`, `UNKNOWN_PUTREFACTION_MARK_INTERACTION`,
  `FRACTURED_STATE_UNDETERMINED`. Every evidenced invalidity (not Rare, corrupted, Desecration
  present, incompatible Bone/Omen) and every combination U-item (U-002, multiple Lich Omens,
  conflicting side Omens) stays in both scopes.
- The exact item check (`status`, `branches`, `poolCompleteness`, ...) is byte-for-byte unchanged.

### Main process / IPC

- `IPC.getLastSnapshot` (`overlay:get-last-snapshot`) returns the snapshot cached by the last
  hotkey/tray read, or `null`. It never reads the clipboard itself.
- Hotkey handler:
  - hidden → read once, show, push the snapshot (unchanged);
  - visible → read once; if the text differs from the cached snapshot, push it and focus the
    overlay; otherwise hide.
- Tray "Show" and second-instance also push a fresh snapshot.
- Hotkey shows/refreshes **without taking keyboard focus** (`showInactive`). This keeps the next
  in-game `Ctrl+C` going to PoE2 while the overlay stays open. Tray/second-instance focus the
  overlay. The overlay takes focus when clicked.
- In the overlay, `Ctrl+V` reads the clipboard (explicit user action, SoT §3.1).

### Renderer

- `Workspace` asks `getLastSnapshot()` on mount if no snapshot has been pushed yet.
- `Escape` calls `hideOverlay()`. The title bar has a read-clipboard button (`readClipboard`).
- The Bone selector is a `radiogroup` of chips built from `boneOptions` (still data-driven). The
  "show incompatible/legacy" toggle lives in the same row.
- Reducer: `bonePreference: Record<targetGroup, boneId>`. On a new item, if the current Bone is not
  selectable, the remembered Bone for the new item's target group is chosen when it is selectable.
  Superseded by spec 014 (SoT 0.2.11): without a remembered choice the default Bone is picked.
- **Pool source switch**:
  `Base pool` (always offered when `basePool.sides` is non-empty) and `This item` (offered when the
  exact check has branches). Default: `This item` when its pool completeness is not `unknown`
  (it knows the current blockers), otherwise `Base pool`.
- Base pool heading: "Possible modifiers for this base" plus a persistent note that current
  modifiers, Mark and Desecration state are not considered. It never uses "Eligible modifier pool"
  (SoT §1.4).
- Exact-item status is always visible as a compact chip ("Exact item check: Unknown"). Its reasons
  sit in a collapsed `<details>`. When the base pool is shown and the exact check is `unknown`, the
  UI says the item's exact Desecration state cannot be confirmed from the clipboard yet. It does
  not show the SoT §22.3 "will not guess" message as the main message.
- Rows: official text, side chip, level, category chips (Lich/Otherworldly coloured), reason for
  blocked/conditional. Level min/max and "show base-ineligible" move into a collapsed "More filters".
- Theme (SoT §16.3): CSS variables only: ink background, abyssal green accent, violet for
  exclusive/Lich, status colours unchanged in meaning. Compact type scale. No images or fonts from
  the game.

## Algorithm/design choice

- *Context:* the exact-item engine fails closed on undetermined item state, and for real items that
  state is always undetermined today.
- *Choice:* compute a second, item-state-independent result with the existing staged pool builder
  (`buildPool` with no remaining affixes, branch kind `base`). There is no parallel implementation,
  so floors, Lich force, Otherworldly and U-013 behave identically.
- *Invariants preserved:* no new mechanic. The base pool is the §14.4 pipeline applied to an empty
  affix set, with the Ancient floor and never the Mark floor. It is labelled not final. The exact
  check is unchanged, and `invalid` still suppresses every list.
- *Trade-off:* the base pool can list modifiers that the exact item blocks (existing groups, Mark
  floor), and it misses modifiers unlocked by tags that existing affixes add. SoT §14.7 states both;
  the UI note says in one line that current modifiers are not taken into account (SoT 0.2.7).

## Acceptance criteria

1. A Rare item with a compatible Bone and no confirmed markers shows a base pool list for both sides
   (or the forced side). The exact item check is `unknown` and, as of SoT 0.2.7, not displayed.
2. The base pool never carries the "Eligible modifier pool" heading, "Eligible" tab label or
   "N eligible" count.
3. Corrupted, non-Rare and already-Desecrated items and incompatible Bone/Omen selections show no
   base pool.
4. U-013 (empty forced Lich pool with floors) yields a base side with `unknown` completeness and no
   list.
5. With the overlay visible, copying a different item and pressing the hotkey shows the new item.
   Pressing it again without a new copy hides the overlay.
6. `Escape` hides the overlay. The read button and `Ctrl+V` re-read the clipboard. The hotkey
   never takes keyboard focus away from the game.
7. A Bone chosen for one weapon is pre-selected for the next weapon. Switching to armour does not
   carry it over.
8. All new strings exist in EN and PL. No probability wording.

## Tests

- `tests/domain/base-pool.test.ts` (TEST_ONLY pack): criteria 1, 3, 4. Also: a side Omen restricts
  sides; the Ancient floor applies and the Mark floor does not; Putrefaction is regular-only; the
  exact check is unchanged for the existing SoT §18.3 cases (suite stays green).
- `tests/integration/pipeline.test.ts` (real pack): clipboard → parser → engine gives a non-empty
  base pool while the exact check stays `unknown` (U-011/U-014).
- `tests/renderer/app.test.tsx`: base pool heading/note, pool switch, chip Bone selector, `Escape`,
  remembered Bone, criterion 2.
- `tests/renderer/view-model.test.ts`: reducer `bonePreference`, rows for base sides.
- `tests/main/main-modules.test.ts`: hotkey decision (`decideHotkeyAction`) pure-function cases.

## Dependencies

005 (engine), 006 (UI; this spec supersedes its layout and theme sections), 001 (IPC).

## Unresolved items

U-011, U-014 unchanged: they block only the exact item check. U-013 is applied unchanged to base
sides. No new U-items.
