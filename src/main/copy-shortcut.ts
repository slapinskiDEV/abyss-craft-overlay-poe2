// The app's only input to another program (SoT §3.1 as of 0.2.6, spec 010): when the user presses
// the overlay hotkey with auto-copy enabled, send the game's advanced copy shortcut (Ctrl+Alt+C,
// SoT §1.3) exactly once. Nothing else is ever sent: no clicks, no crafting, no chat.
import koffi from 'koffi';

// Win32 virtual-key codes and keybd_event flag (winuser.h).
const VK_SHIFT = 0x10;
const VK_CONTROL = 0x11;
const VK_MENU = 0x12; // Alt
const VK_C = 0x43;
const KEYEVENTF_KEYUP = 0x0002;
const MAPVK_VK_TO_VSC = 0;
/** Pause after each modifier event (spec 016). */
export const KEY_STEP_MS = 4;
/** How long C stays down: longer than one frame at 60 fps, so a per-frame sampler sees it. */
export const KEY_HOLD_MS = 25;

export interface KeyEvent { vk: number; up: boolean }

/**
 * Ctrl+Alt+C while the user may still hold the hotkey's modifiers (SoT §3.1). Shift (older default
 * Ctrl+Shift+D) is released first so the game sees Ctrl+Alt+C. Ctrl and Alt are pressed and always
 * released again, even when the hotkey itself holds Alt (default Alt+T).
 *
 * Design choice (spec 017 A9): the final Alt-up makes Windows treat a still-held Alt as released,
 * so holding Alt+T past key repeat (~0.5 s) can send a plain T to the game. Skipping that Alt-up
 * would instead leave Alt stuck down in the game whenever the player lets go during the ~50 ms
 * sequence, which is worse. Manual check: spec 017 F4. Pure for tests.
 */
export function copyShortcutSequence(): KeyEvent[] {
  return [
    { vk: VK_SHIFT, up: true },
    { vk: VK_CONTROL, up: false },
    { vk: VK_MENU, up: false },
    { vk: VK_C, up: false },
    { vk: VK_C, up: true },
    { vk: VK_MENU, up: true },
    { vk: VK_CONTROL, up: true },
  ];
}

interface User32 {
  keybdEvent: (vk: number, scan: number, flags: number, extra: number) => void;
  mapVirtualKey: (code: number, mapType: number) => number;
  clipboardSequenceNumber: () => number;
}
let user32: User32 | null | undefined;

function load(): User32 | null {
  if (user32 !== undefined) return user32;
  try {
    const lib = koffi.load('user32.dll');
    user32 = {
      keybdEvent: lib.func('void __stdcall keybd_event(uint8_t bVk, uint8_t bScan, uint32_t dwFlags, uintptr_t dwExtraInfo)'),
      mapVirtualKey: lib.func('uint32_t __stdcall MapVirtualKeyW(uint32_t uCode, uint32_t uMapType)'),
      clipboardSequenceNumber: lib.func('uint32_t __stdcall GetClipboardSequenceNumber()'),
    };
  } catch {
    user32 = null;
  }
  return user32;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Windows clipboard sequence number (spec 018): changes whenever the clipboard content changes and
 * can be read without opening the clipboard, so waiting for the game's copy never blocks the game's
 * own clipboard write or this app's main thread. Reads no content. null where unsupported.
 */
export function clipboardSequenceNumber(): number | null {
  if (process.platform !== 'win32') return null;
  const api = load();
  return api ? api.clipboardSequenceNumber() : null;
}

/**
 * Sends the copy shortcut once. Each event carries the hardware scan code (games that read raw
 * input ignore scan code 0); C is held for KEY_HOLD_MS, other events are KEY_STEP_MS apart. Resolves false where unsupported
 * (non-Windows or load failure).
 */
export async function sendCopyShortcut(): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  const api = load();
  if (!api) return false;
  for (const e of copyShortcutSequence()) {
    api.keybdEvent(e.vk, api.mapVirtualKey(e.vk, MAPVK_VK_TO_VSC), e.up ? KEYEVENTF_KEYUP : 0, 0);
    await sleep(e.vk === VK_C && !e.up ? KEY_HOLD_MS : KEY_STEP_MS);
  }
  return true;
}
