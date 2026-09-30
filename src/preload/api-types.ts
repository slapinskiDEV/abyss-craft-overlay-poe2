// Typed bridge exposed as window.overlayApi (spec 001 "IPC API").
import type { DataPack } from '../data/normalized/types';
import type { DataManifestSummary } from '../domain/desecration/types';

export interface LocalizationSettings {
  uiLocale: string; // registry ID; MVP values 'en' | 'pl' (SoT §5.6)
  gameLocale: string; // MVP: 'en'
  clipboardLocale: string; // 'auto' | parser locale; MVP: 'auto' | 'en'
}

export interface WindowBounds { x?: number; y?: number; width: number; height: number }

export interface AppSettings {
  localization: LocalizationSettings;
  hotkey: string;
  closeOnBlur: boolean;
  /** Hotkey sends the game's copy shortcut once before reading the clipboard (spec 010). */
  autoCopy: boolean;
  showLegacyCurrencies: boolean;
  showDataVersion: boolean;
  window: WindowBounds;
  onboardingCompleted: boolean;
  /** Check GitHub Releases for a new app version (SoT §3.5, spec 011). */
  checkForUpdates: boolean;
  /** Last release-notes entry the player closed (src/shared/changelog.ts); null before the first. */
  changelogSeen: string | null;
  /** 2: three-column layout (wider window once); 3/4: Ctrl+Shift+D moves to Alt+T (SoT 0.2.12). */
  settingsSchemaVersion: 4;
}

/**
 * App update state (spec 011). `manual`: the portable build cannot install itself; the button
 * opens the download page instead.
 */
export type UpdateStatus =
  | { state: 'none' }
  | { state: 'available'; version: string; manual: boolean }
  | { state: 'downloading'; version: string; doneMb: number; totalMb: number }
  | { state: 'ready'; version: string }
  | { state: 'failed' };

export interface ClipboardSnapshot { text: string; readAt: string }

export type DataPackLoadResult =
  | { ok: true; pack: DataPack }
  | { ok: false; code: 'DATA_PACK_MISSING' | 'DATA_PACK_INTEGRITY_FAILED' | 'DATA_PACK_NOT_VALIDATED' | 'DATA_PACK_SCHEMA_UNSUPPORTED' };

export type HotkeyRegistrationResult =
  | { ok: true; accelerator: string }
  | { ok: false; code: 'HOTKEY_REGISTRATION_FAILED' | 'HOTKEY_INVALID'; accelerator: string };

export interface AppInfo {
  appVersion: string;
  platform: string;
  dataManifest: DataManifestSummary | null;
}

export type Unsubscribe = () => void;

export interface OverlayApi {
  onClipboardSnapshot(cb: (snap: ClipboardSnapshot) => void): Unsubscribe;
  readClipboard(): Promise<ClipboardSnapshot>;
  /** The snapshot of the last show/refresh, or null; does not read the clipboard. */
  getLastSnapshot(): Promise<ClipboardSnapshot | null>;
  writeDebugReport(text: string): Promise<void>;
  getSettings(): Promise<AppSettings>;
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>;
  onSettingsChanged(cb: (s: AppSettings) => void): Unsubscribe;
  loadDataPack(): Promise<DataPackLoadResult>;
  getAppInfo(): Promise<AppInfo>;
  hideOverlay(): void;
  resetWindowPosition(): void;
  setHotkey(accelerator: string): Promise<HotkeyRegistrationResult>;
  getUpdateStatus(): Promise<UpdateStatus>;
  onUpdateStatus(cb: (s: UpdateStatus) => void): Unsubscribe;
  /** Downloads and installs the available update (or opens the download page). */
  startUpdate(): void;
  /** true while the hotkey copies the hovered item; false when it is shown or nothing changed. */
  onCopyBusy(cb: (busy: boolean) => void): Unsubscribe;
  /** A text field was pressed: the overlay may take keyboard focus while typing (spec 015). */
  requestKeyboardFocus(): void;
  releaseKeyboardFocus(): void;
  /** Result of the last hotkey registration; a failure at startup is shown in the overlay (spec 017 A7). */
  getHotkeyStatus(): Promise<HotkeyRegistrationResult>;
}
