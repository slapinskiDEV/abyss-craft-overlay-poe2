// Hotkey decision (SoT §16.1, spec 009). Pure so it can be tested without Electron.
export type HotkeyAction = 'show' | 'refresh' | 'hide';

/**
 * Hidden -> show the freshly read item. Visible -> a newly copied item replaces the shown one;
 * pressing again without a new copy hides the overlay.
 */
export function decideHotkeyAction(visible: boolean, shownText: string | undefined, clipboardText: string): HotkeyAction {
  if (!visible) return 'show';
  return clipboardText !== shownText ? 'refresh' : 'hide';
}
