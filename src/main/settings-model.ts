// Settings defaults and validation (spec 001). Pure: no Electron, no fs.
import { resolveUiLocale, isRegisteredUiLocale } from '../i18n/resolve-locale';
import { GAME_TERM_PROVIDERS } from '../i18n/game/providers/registry';
import { PARSER_ADAPTERS } from '../parser/registry';
import type { AppSettings } from '../preload/api-types';
import { isChangelogEntry } from '../shared/changelog';
import { isValidAccelerator } from './accelerator';

export const DEFAULT_HOTKEY = 'Alt+T'; // SoT §16.1 (0.2.12)
/** Ctrl+Shift+D, the default before SoT 0.2.12, in any accelerator spelling or order (Control, Ctrl, CommandOrControl, CmdOrCtrl). */
export function isPreviousDefaultHotkey(accelerator: unknown): boolean {
  if (typeof accelerator !== 'string') return false;
  const ctrl = new Set(['control', 'ctrl', 'commandorcontrol', 'cmdorctrl']);
  const parts = accelerator.split('+').map((p) => p.trim().toLowerCase());
  const key = parts.at(-1);
  const mods = parts.slice(0, -1);
  return key === 'd' && mods.length === 2 && mods.includes('shift') && mods.some((m) => ctrl.has(m));
}

export function defaultSettings(osLocale: string): AppSettings {
  return {
    localization: { uiLocale: resolveUiLocale(osLocale), gameLocale: 'en', clipboardLocale: 'auto' },
    hotkey: DEFAULT_HOTKEY,
    closeOnBlur: false, // SoT §16.3
    autoCopy: true, // SoT §3.1 (0.2.6), spec 010
    showLegacyCurrencies: false, // SoT §2.2
    showDataVersion: true,
    window: { width: 1180, height: 760 }, // three columns (SoT 0.2.9)
    onboardingCompleted: false,
    checkForUpdates: true, // SoT §3.5 (0.2.8), spec 011
    changelogSeen: null,
    settingsSchemaVersion: 4,
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Validates stored or patched settings against the registries. Invalid fields fall back to the
 * defaults; the result is always a complete, valid AppSettings.
 */
export function sanitizeSettings(input: unknown, defaults: AppSettings): AppSettings {
  const src = isObject(input) ? input : {};
  const loc = isObject(src.localization) ? src.localization : {};
  // Schema 1 predates the three-column layout: its narrow window is replaced by the new default.
  const schema = typeof src.settingsSchemaVersion === 'number' ? src.settingsSchemaVersion : 0;
  const win = isObject(src.window) && schema >= 2 ? src.window : {};
  // Schema < 4: Ctrl+Shift+D (the old default, in any spelling) moves to Alt+T once. Schema 3 only
  // matched the exact default spelling, so 'Control+Shift+D' was missed.
  const hotkey = schema < 4 && isPreviousDefaultHotkey(src.hotkey) ? defaults.hotkey : src.hotkey;
  const pick = <T>(value: unknown, ok: (v: unknown) => v is T, fallback: T): T => (ok(value) ? value : fallback);
  const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
  const isUi = (v: unknown): v is string => typeof v === 'string' && isRegisteredUiLocale(v);
  const isGame = (v: unknown): v is string => typeof v === 'string' && GAME_TERM_PROVIDERS.some((p) => p.locale === v);
  const isClipboard = (v: unknown): v is string => v === 'auto' || (typeof v === 'string' && PARSER_ADAPTERS.some((a) => a.locale === v));
  const isHotkey = (v: unknown): v is string => typeof v === 'string' && isValidAccelerator(v);
  const size = (v: unknown, min: number, fallback: number) => (finite(v) && v >= min && v <= 10000 ? Math.round(v) : fallback);

  return {
    localization: {
      uiLocale: pick(loc.uiLocale, isUi, defaults.localization.uiLocale),
      gameLocale: pick(loc.gameLocale, isGame, defaults.localization.gameLocale),
      clipboardLocale: pick(loc.clipboardLocale, isClipboard, defaults.localization.clipboardLocale),
    },
    hotkey: pick(hotkey, isHotkey, defaults.hotkey),
    closeOnBlur: pick(src.closeOnBlur, isBool, defaults.closeOnBlur),
    autoCopy: pick(src.autoCopy, isBool, defaults.autoCopy),
    showLegacyCurrencies: pick(src.showLegacyCurrencies, isBool, defaults.showLegacyCurrencies),
    showDataVersion: pick(src.showDataVersion, isBool, defaults.showDataVersion),
    window: {
      ...(finite(win.x) ? { x: Math.round(win.x) } : {}),
      ...(finite(win.y) ? { y: Math.round(win.y) } : {}),
      width: size(win.width, 320, defaults.window.width),
      height: size(win.height, 240, defaults.window.height),
    },
    onboardingCompleted: pick(src.onboardingCompleted, isBool, defaults.onboardingCompleted),
    checkForUpdates: pick(src.checkForUpdates, isBool, defaults.checkForUpdates),
    changelogSeen: isChangelogEntry(src.changelogSeen) ? src.changelogSeen : defaults.changelogSeen,
    settingsSchemaVersion: 4,
  };
}

export function mergeSettings(current: AppSettings, patch: unknown, defaults: AppSettings): AppSettings {
  const p = isObject(patch) ? patch : {};
  return sanitizeSettings(
    {
      ...current,
      ...p,
      localization: { ...current.localization, ...(isObject(p.localization) ? p.localization : {}) },
      window: { ...current.window, ...(isObject(p.window) ? p.window : {}) },
    },
    defaults,
  );
}
