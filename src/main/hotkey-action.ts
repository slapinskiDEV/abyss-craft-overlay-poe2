// Hotkey decision (SoT §16.1, spec 009). Pure so it can be tested without Electron.
export type HotkeyAction = 'show' | 'refresh' | 'hide' | 'keep';

/**
 * Hidden -> show the freshly read item. Visible -> a newly copied item replaces the shown one;
 * pressing again without a new copy hides the overlay. SoT 0.2.15: when the auto-copy never arrived
 * (`copyMissed`), a visible overlay is kept ('keep') and tells the player instead of hiding.
 */
export function decideHotkeyAction(visible: boolean, shownText: string | undefined, clipboardText: string, copyMissed = false): HotkeyAction {
  if (!visible) return 'show';
  if (clipboardText !== shownText) return 'refresh';
  return copyMissed ? 'keep' : 'hide';
}
