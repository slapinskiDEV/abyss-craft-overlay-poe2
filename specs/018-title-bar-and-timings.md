# 018 — Title bar without an OS drag region; hotkey timings

**SoT refs:** §16.1, §16.3 (draggable header; 0.2.12 keyboard focus), §15.3 (debug report)

## Goal

On Windows the title-bar buttons (×, settings) must work, and dragging the title must move the
window without freezing it. The debug report must show where the time of an `Alt+T` press goes.

## Problem (maintainer report, v0.4.18)

- × does not close the overlay; ⚙ does not open the settings and the overlay freezes after the click.
- Switching items with `Alt+T` still feels slow.

Cause of the first: the title bar was a CSS `-webkit-app-region: drag` area with `no-drag` buttons.
In the non-focusable overlay (spec 015, `focusable: false`) Windows treated clicks on the title bar,
buttons included, as a window-move start: the click never reached the button and the move loop held
the window until the next click.

## In scope

- No `-webkit-app-region` anywhere. The title (brand) is dragged in JS: pointer capture on
  pointer-down, each pointer move sends the delta (`moveWindowBy`, validated integers ≤ 4000 DIP) and
  main moves the window; the existing `move` handler saves the bounds. The buttons are plain buttons.
- Debug report `timings`: from main, the last ten hotkey copies (`sendMs` hotkey → copy sent,
  `totalMs` hotkey → clipboard changed or wait ended, `clipboardChanged`, action); from the renderer,
  the last ten times from a new clipboard text to the next painted frame (`renderMs`). Nothing else is
  recorded and nothing leaves the machine unless the player copies the report.

## Out of scope

- Any change to the copy sequence or the bounded wait (spec 010, 016) before the timings show the
  cause of the delay.

## Algorithm/design choice

- *Why not keep a CSS drag region with a focusable window:* the overlay must not take keyboard focus
  (spec 015). A JS drag keeps the window non-focusable.
- *Drag state in a ref:* moving the window saves its bounds, which re-renders the shell; state kept
  per render would drop the drag after the first save.

## Acceptance criteria

1. On Windows, × hides the overlay and ⚙ opens the settings, every time, without freezing.
2. Dragging the title moves the window, also across monitors; the position is restored after restart.
3. "Copy debug report" contains `timings.copy` and `timings.renderMs` after a few `Alt+T` presses.

## Tests

`tests/renderer/app.test.tsx` (buttons, drag delta), `tests/architecture/renderer-catalog-guard.test.ts`
(no `app-region` in the stylesheet), manual check on Windows.

## Dependencies

001, 015, 016.
