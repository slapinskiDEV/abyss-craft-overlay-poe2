// Global hotkey (SoT §16.1). It only toggles this app; it never sends input to PoE2 (SoT §3.1).
import { globalShortcut } from 'electron';
import type { HotkeyRegistrationResult } from '../preload/api-types';
import { isValidAccelerator } from './accelerator';

let registered: string | null = null;

export function registerToggleHotkey(accelerator: string, onToggle: () => void): HotkeyRegistrationResult {
  if (!isValidAccelerator(accelerator)) return { ok: false, code: 'HOTKEY_INVALID', accelerator };
  if (registered) globalShortcut.unregister(registered);
  registered = null;
  let ok = false;
  try {
    ok = globalShortcut.register(accelerator, onToggle);
  } catch {
    ok = false;
  }
  if (!ok) return { ok: false, code: 'HOTKEY_REGISTRATION_FAILED', accelerator };
  registered = accelerator;
  return { ok: true, accelerator };
}

export function unregisterAll(): void {
  globalShortcut.unregisterAll();
  registered = null;
}
