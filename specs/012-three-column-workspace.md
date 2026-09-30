# 012 — Three-column workspace, free slots, item preview

**SoT refs:** §3.1 (0.2.9), §16.4 (0.2.9)

## Goal

A roomier, faster-to-read overlay: choices on the left, the modifier list in the centre, the item on
the right as in the game, with the free affix slots and the picked modifier previewed on it.

## In scope

- `Workspace`: `.columns` grid `craft | pool | item`; stacks below 960 px (item first).
- `ItemPreview`: name/base in rarity colour, class, item level, free slots, the item's modifier lines
  (prefixes, suffixes, unknown side), the picked modifier as "Desecrated · preview" after its side.
- Domain `affixSlots(item, pack)`: `used/max/free` per side from `pack.affixLimits`; `basis:
  'recognized_only'` while existing Desecration is not `absent` (U-011, U-014); `undetermined` for
  non-Rare items, classes without a limit, or affixes with an unknown side.
- Domain `usableOmenIds(item, boneId, pack)`: drops Omens with a Bone-compatibility reason for the
  chosen Bone, or for every Bone usable on the item when none is chosen.
- Rows of the eligible view are selectable (click/Enter/Space); a second click clears the preview.
  Blocked rows are not selectable.
- Hotkey with a focused overlay: hide, wait 80 ms, copy (spec 010).
- Settings schema 2: default window 1180×760; schema-1 bounds are replaced once.
- Base font 14 px; item name 19 px; pool heading 17 px; counts and free slots 15 px.

## Out of scope

- Trade site search link (needs trade stat IDs, a new data source; not in the SoT).
- Showing removal branches in the preview (a full side is not simulated).

## Algorithm/design choice

- Free slots reuse the evidenced `affixLimits` the engine already uses for branch generation, so the
  hint and the engine cannot disagree.
- The preview is presentation only; it never feeds back into the evaluation.

## Acceptance criteria

1. Wide window: three columns; narrow: stacked without overlap.
2. Free slots match `max − used` per side; `*` with explanation while Desecration is undetermined.
3. Clicking an eligible row shows it on the item; clicking again or changing item/Bone/Omen clears it.
4. Omens incompatible with the Bone are absent; conflicting combinations stay disabled.
5. With the overlay focused, hovering an item and pressing the hotkey shows that item (Windows).

## Tests

`tests/domain/slots-and-omens.test.ts`, `tests/renderer/app.test.tsx`, `tests/main/main-modules.test.ts`
(schema migration), manual: `tests/manual/overlay/CHECKLIST.md`.

## Dependencies

005, 006, 010.

## Unresolved items

None new; U-011/U-014 qualify the slot count.
