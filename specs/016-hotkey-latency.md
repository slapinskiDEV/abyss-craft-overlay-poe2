# 016 — Hotkey latency and loading state

**SoT refs:** §3.1, §16.3 (0.2.13)

## Goal

After `Alt+T` over an item the player sees a reaction at once and the new item as soon as the game
has copied it (maintainer report: 1–2 s before the item changed).

## Measured

Parse + evaluation + rows on the real pack: about 20 ms per item (warm), so the engine is not the
cause. Remaining delay: Chromium background throttling of the hidden/unfocused overlay renderer,
the key sequence (7 × 15 ms), and 40 ms clipboard polling.

## In scope

- `backgroundThrottling: false` for the overlay renderer.
- Key sequence: modifiers 4 ms apart, `C` held 25 ms (> one 60 fps frame); about 50 ms total.
- Clipboard poll 15 ms (bound unchanged: 600 ms, one hotkey press only, SoT §16.2).
- IPC push `copyBusy` true/false around the copy; a hidden overlay is shown without focus at once.
- Renderer: dimmed, greyscaled window with the spinning app diamond (`role=status`), cleared on
  `copyBusy=false` or after 3 s.

## Out of scope

- A keyboard hook or window inspection to copy earlier (forbidden by SoT §3.1).

## Acceptance criteria

1. `Alt+T` → loading state within a frame; the item appears as soon as the clipboard changes.
2. Same item → loading state, then the overlay hides.
3. Copy still accepted by the game (manual, Windows).

## Tests

`tests/renderer/app.test.tsx` (loading state), `tests/main/main-modules.test.ts` (copy flow),
manual checklist.

## Dependencies

010, 015.
