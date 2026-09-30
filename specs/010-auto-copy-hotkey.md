# 010 — Auto-copy on hotkey

**SoT refs:** §1.3, §3.1 (auto-copy exception, 0.2.6), §16.1, §16.2, §16.7

## Goal

The maintainer's flow is one key press: hover an item in PoE2, press `Ctrl+Shift+D`, and the
overlay copies the item and shows it. The next item replaces the previous one. The same item again,
or `Escape`, closes the overlay. Until now the player also had to press `Ctrl+Alt+C` manually.

## In scope

- `src/main/copy-shortcut.ts`: the only module that sends input. It sends Win32 `keybd_event`
  through `koffi`: Shift up, Ctrl down, Alt down, C down, C up, Alt up, Ctrl up. Each event carries
  the hardware scan code (`MapVirtualKeyW`) and events are spaced by `KEY_STEP_MS` (15 ms).
- `src/main/copy-flow.ts`: read the clipboard, send once, wait up to `COPY_WAIT_MS` (600 ms, poll
  every 40 ms) for a change, then return the clipboard.
- Main hotkey handler, the `autoCopy` setting (default `true`), settings checkbox, onboarding and
  hint texts (EN/PL).

## Out of scope

- Any other input: clicks, crafting, Omens, chat, repeats, timers.
- Checking which program is in the foreground (no process/window inspection, SoT §3.1).
- Non-Windows platforms: `sendCopyShortcut()` returns `false` and the flow is a plain read.

## Interfaces / contracts

```ts
copyShortcutSequence(): Array<{ vk: number; up: boolean }>   // pure
sendCopyShortcut(): Promise<boolean>                          // false = unsupported
copyThenRead(deps: { read; sendCopy; sleep }): Promise<ClipboardSnapshot>
AppSettings.autoCopy: boolean
```

Hotkey handler (`main.ts`):

1. Overlay visible and focused → hide, wait `REFOCUS_MS` (80 ms) so Windows returns focus to the
   game, then continue with step 2 (SoT 0.2.9). No keys are sent into our own window.
2. Otherwise, with `autoCopy` on, `copyThenRead`; with it off, a single read.
3. `decideHotkeyAction(visible, shownText, text)` (spec 009): show/refresh without taking focus,
   or hide when the text is unchanged.
4. Presses while a copy is in flight are ignored.

## Algorithm/design choice

- *Why keybd_event via koffi:* koffi 2.x ships prebuilt N-API binaries in the npm package, so
  there is no native compilation on CI. The Windows x64 binary is the only one packaged
  (`electron-builder.yml`). A persistent PowerShell `SendKeys` helper would need `child_process`
  and cannot release the physically held Shift.
- *Why release Shift first:* the user still holds `Ctrl+Shift` of the hotkey when it fires. Without
  releasing Shift the game would receive `Ctrl+Shift+Alt+C`.
- *Default hotkey Alt+T (spec 015, 017 A9):* the release of Shift stays harmless. Alt is pressed and
  released again although the player holds it; the final Alt-up can make a still-held `Alt+T` type a
  plain `T` after key repeat (~0.5 s), while skipping it would leave Alt stuck whenever the player
  lets go during the sequence. The stuck key is worse, so the sequence is unchanged (manual check 017 F4).
- *Scan codes and spacing:* in the first Windows test the hotkey did not copy the item. The sent
  events had scan code 0 and no duration. Games that read raw input see only the scan code, and
  games that sample key state once per frame can miss a zero-length tap, so both are now set.
- *Bounded wait:* the clipboard is read at most 16 times within one hotkey press. There is no
  continuous polling (SoT §16.2).

## Acceptance criteria

1. Overlay hidden, item hovered, hotkey → overlay shows that item.
2. Overlay open, another item hovered, hotkey → the new item replaces the old one.
3. Same item hovered (or nothing), hotkey → the overlay hides.
4. Focus stays in the game after 1–2, so the next press works without clicking.
5. `autoCopy` off → no input is sent; the spec 009 behavior applies.
6. Architecture test: `keybd_event` and `koffi` appear only in `copy-shortcut.ts`; only VK codes
   Shift/Ctrl/Alt/C exist there.

## Tests

`tests/main/main-modules.test.ts` (sequence, copy flow with fakes),
`tests/architecture/runtime-boundary.test.ts` (single exception),
manual: `tests/manual/overlay/CHECKLIST.md` (Windows, Windowed Fullscreen).

## Dependencies

001, 009.

## Unresolved items

None new. Whether the game accepts the synthetic shortcut in every display mode is a manual
Windows check (SoT §19.3).
