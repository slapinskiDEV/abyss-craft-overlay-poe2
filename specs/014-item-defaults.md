# 014 — Defaults for a new item

**SoT refs:** §16.4 (0.2.11), U-012

## Goal

A copied item is ready to read without clicks: a sensible Bone is chosen and the side filter shows
the side the item has room on.

## In scope

- `defaultBoneId(item, pack)`: first usable, non-legacy Bone in pack order with neither
  `maxItemLevel` nor `minimumModifierLevel`; else the first usable Bone. No names in code.
- Order of precedence: current Bone if still usable → remembered Bone of the target group (spec
  009) → default. A Bone the user deselects stays deselected until the next item (`boneCleared`).
- `defaultSides(affixSlots(...))`: exactly one side with free slots → that side; otherwise both.
  Applied once per new item; the user can toggle the chips.
- Note under the filters while the filter shows only the open side: choosing the full side is
  unverified (U-012).

## Out of scope

- Recommending Omens, modifiers or outcomes; any ranking by value or probability.

## Algorithm/design choice

- The default Bone is derived from data fields, so a pack update that changes the restrictions
  changes the default without code changes.
- The side default is a view filter, not an engine input: the evaluation is unchanged.

## Acceptance criteria

1. New weapon without a remembered Bone → the unrestricted Jawbone-family Bone from the pack is
   selected (for the current pack: the one without item-level limit and floor).
2. Only suffixes free → Suffix chip on, Prefix off, note shown. Only prefixes free → the reverse.
   Both free, both full or undetermined → both on, no note.
3. Deselecting the Bone leaves no Bone selected for that item.

## Tests

`tests/domain/slots-and-omens.test.ts`, `tests/renderer/app.test.tsx`.

## Dependencies

009, 012.

## Unresolved items

U-012 (stated in the note).
