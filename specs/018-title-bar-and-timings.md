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

## Follow-up (maintainer report on v0.4.20)

"After some Alt+T presses nothing in the overlay can be clicked", at random; the debug report
cannot be copied then. Local stress test on the real pack: 1200 random items, parse + evaluation +
rows at most 61 ms, median 6 ms — not the cause. Changes, since the cause is not proven:

- The copy loading layer is visual only (`pointer-events: none`); it never blocks clicks.
- The title drag ends on window blur, on the window being hidden, on any pointer-up and when a move
  arrives without a pressed button, so a pointer capture cannot outlive the drag.
- A renderer Windows reports as not responding is restarted (`unresponsive` → renderer crash →
  reload, at most three times a minute).
- Tray menu: "Reload overlay" (escape hatch) and "Open log folder".
- Local log `userData/logs/overlay.log` (rotated at 512 KB): hotkey presses (visible, focused), copy
  result and time, show/hide, keyboard focus allow/release, renderer unresponsive/gone. No clipboard
  text; stays on the machine until the player sends it.

## Follow-up 2: cause found in the log (maintainer log, v0.4.22)

The local log showed hotkey presses taking 150 ms to 4.4 s from key to item, and the clipboard often
not changing at all (`clipboardChanged: false` → the overlay hid). A press with `refresh` took
3.8 s although the wait is bounded to 600 ms: the bound counted only the sleeps between reads, and
each synchronous clipboard read took ~80–100 ms. Reading the clipboard every 15 ms while the game
writes it makes both sides wait on the Windows clipboard lock: the game's copy is delayed or fails,
and the blocked main thread cannot handle window messages, so the overlay does not react to clicks.

Changes:

- On Windows the wait polls the clipboard **sequence number** (`GetClipboardSequenceNumber`, every
  10 ms) — no clipboard access, no lock. The text is read once after the number changed, re-read
  up to five times while empty (the game empties the clipboard before writing).
- The 600 ms bound is wall-clock time. Elsewhere the text polling (spec 016) stays as fallback.
- The log records per press: `sendMs`, `showMs` (showing the window), `waitMs`, `readMs`, `polls`.
- The sequence number is read from `src/main/copy-shortcut.ts`, the one module allowed to use
  `koffi` (runtime boundary test); it reads no content and sends nothing.

## Follow-up 3 (maintainer log, v0.4.24)

The sequence-number wait works (`readMs: 0`, the game's copy arrives after ~15 ms). Still seen:
0.7–1.6 s between the hotkey and the start of the copy flow with nothing measured in between, and
presses after a restart where the game never copied (focus left the game, e.g. through the tray).
The unclickable state still cannot be told apart. Changes:

- The log is written asynchronously through a queue; the synchronous append (possibly slowed by a
  virus scanner) could itself stall the main thread.
- `main:lag` when the main thread's 250 ms timer is more than 300 ms late.
- Renderer heartbeat every 2 s (`renderer:lag` above 300 ms, `renderer:silent` after 5 s without
  one while visible) and `renderer:pointerdown` (at most once a second) when a press reaches the
  page. Unclickable with pointer presses logged → page logic; without → input never reaches the
  window; with `main:lag` → blocked main thread.
- The copy flow reads the text once before the copy; a sequence change that leaves the same text no
  longer ends the wait (it made the overlay hide although the new item was still coming).

## Follow-up 4 (maintainer report and log, v0.4.26)

Hotkey presses now take 130–160 ms; no main or renderer stalls were logged, and clicks reached the
page. The overlay breaks after a **hide → show without focus** cycle: an `Alt+T` whose copy does not
arrive hides it, the next `Alt+T` shows it with `showInactive`, and that window no longer reacts.
The first show after start (`show` + focus) works.

Working hypothesis: Chromium's native window occlusion tracking keeps treating the overlay as hidden
after `showInactive` over the fullscreen game, so the page stops painting. Changes:

- `--disable-features=CalculateNativeWinOcclusion`.
- Every show without focus is followed by `webContents.invalidate()` (fresh frame).
- `renderer:visibility` in the log (page visible/hidden plus whether the window is shown); a hidden
  page in a shown window confirms the hypothesis.

## Follow-up 5 (log analysis, v0.4.26; SoT 0.2.15)

Every "the overlay suddenly disappears" in the log is a press whose copy never arrived
(`clipboardChanged: false`, sequence unchanged for 600 ms). It was treated like a press on the same
item and hid the overlay; the next press failed too and showed the old item — a hide/show loop that
looked like a broken window. Failures come in streaks: right after start until the game is clicked
(game not focused), and while the cursor is over the overlay instead of the item (the default
1180×760 window easily covers the inventory). `sendMs` ≈ 120 ms instead of ~50 ms is Windows timer
granularity (~15.6 ms per sleep), harmless.

Changes (SoT §16.1, 0.2.15): the copy result tells `copied` (sequence changed) from `changed` (text
changed). Same text after a change = same item → hides as before (follow-up 3's "keep waiting" is
dropped). Nothing copied → a visible overlay stays (`keep`) and shows a hint (EN/PL) to hover an item
in the active game window, not covered by the overlay; the next item clears it.

## Follow-up 6 (maintainer repro, v0.4.29)

Exact repro: `Alt+T` twice on the same item (second press hides, as designed), then `Alt+T` again —
the reopened window is broken. Disabling occlusion tracking (follow-up 4) did not help, so the
Windows `hide()` → `showInactive()` cycle of the non-focusable, always-on-top window itself is the
trigger; the first show after start works.

Change: on Windows the overlay is never hidden by the OS after its first show. Hiding makes it fully
transparent (`setOpacity(0)`) and click-through (`setIgnoreMouseEvents(true)`), and blurs it if it
had keyboard focus (a real hide gave focus back to the game); showing restores opacity and mouse
input, raises it and forces a repaint. `isOverlayShown` replaces `isVisible` for the hotkey logic.
Every show/hide in `main.ts` goes through these helpers (architecture test). Other platforms keep
real hide/show.

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
