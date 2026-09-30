// Electron accelerator validation (spec 001). Requires a modifier so a plain key can never be taken
// globally, and a single non-modifier key.
const MODIFIERS = new Set(['Command', 'Cmd', 'Control', 'Ctrl', 'CommandOrControl', 'CmdOrCtrl', 'Alt', 'Option', 'AltGr', 'Shift', 'Super', 'Meta']);
const KEY = /^([A-Z0-9]|F([1-9]|1[0-9]|2[0-4])|Plus|Space|Tab|Backspace|Delete|Insert|Return|Enter|Up|Down|Left|Right|Home|End|PageUp|PageDown|Escape|Esc|[`~!@#$%^&*()\-_=[\]{};:'",.<>/?\\|])$/;

export function isValidAccelerator(accelerator: string): boolean {
  const parts = accelerator.split('+').map((p) => p.trim());
  if (parts.length < 2 || parts.some((p) => p.length === 0)) return false;
  const key = parts.at(-1) ?? '';
  const mods = parts.slice(0, -1);
  return mods.every((m) => MODIFIERS.has(m)) && new Set(mods).size === mods.length && KEY.test(key) && !MODIFIERS.has(key);
}
