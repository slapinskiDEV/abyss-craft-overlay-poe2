# 015 — Keep keyboard focus in the game; default hotkey Alt+T

**SoT refs:** §3.1, §16.1 (0.2.12), §16.3 (0.2.12)

## Goal

Hover an item, press the hotkey, see it; hover the next, press again, see that one. No click in the
game first, no press that only closes the overlay.

## Problem

The copy shortcut (spec 010) goes to the focused window. After the player clicked in the overlay
(a Bone, an Omen), the overlay held keyboard focus, the game did not receive `Ctrl+Alt+C`, the
clipboard stayed unchanged, and the unchanged text was taken for "same item" → hide. The next press
showed the old item again.

## In scope

- Windows: `BrowserWindow({ focusable: false })`. Clicks on buttons work without activating the
  window, so the game keeps focus.
- Text fields: `mousedown` on `input/select/textarea` → `requestKeyboardFocus` →
  `setFocusable(true)` + `focus()`; blur to a non-text target → `releaseKeyboardFocus` →
  `setFocusable(false)`. Hotkey while focused: release, hide, 80 ms, copy (spec 010/012 path kept).
- Default hotkey `Alt+T`; settings schema 4 moves Ctrl+Shift+D once in any accelerator spelling
  (`CommandOrControl`, `Control`, `Ctrl`, `CmdOrCtrl`, any order). Schema 3 matched only the exact
  default spelling and missed a stored `Control+Shift+D` (maintainer report).
- Texts use the configured hotkey; README, checklist and SoT examples updated.

## Out of scope

- Detecting the game window or process (SoT §3.1); a keyboard hook that listens without consuming
  keys (would need a native hook module, forbidden by the runtime boundary).

## Algorithm/design choice

- *Why not check the foreground window:* forbidden (no window inspection). A non-activating overlay
  removes the cause instead.
- *Alt+T and the copy shortcut:* the player holds Alt; the sequence still presses Ctrl and Alt and
  releases both, so the game sees `Ctrl+Alt+C`; Shift is released first as before.
- Linux/macOS keep a focusable window (an unfocusable one may get no input at all there).

## Acceptance criteria

1. Click a Bone, hover an item in the game, `Alt+T` → that item is shown; repeat with other items.
2. `Alt+T` on the same item → overlay hides; `Alt+T` again → shows it.
3. Typing in the search works; after clicking back into the game the hotkey works at once.
4. Existing settings on the old default hotkey start with `Alt+T`; custom hotkeys unchanged.

## Tests

`tests/renderer/app.test.tsx` (focus requests), `tests/main/main-modules.test.ts` (schema 3),
manual: `tests/manual/overlay/CHECKLIST.md`.

## Dependencies

010, 012.

## Unresolved items

None. Whether `Alt+T` collides with a PoE2 keybinding is a manual check; the hotkey is configurable.
