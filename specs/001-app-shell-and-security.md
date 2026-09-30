# 001 — App shell and security

**SoT refs:** §0.2 rule 8, §3 (runtime boundary), §4 (stack/architecture), §5.6 (settings), §6.1, §15.3, §16.1–16.3, §16.7, §22.1–22.2

## Goal

Provide the Electron shell that hosts the overlay: a frameless always-on-top window toggled by a
global hotkey, which reads the clipboard exactly once per invocation, loads only a validated
bundled data pack, and never interacts with the PoE2 process, its input or its files.

## In scope

- Main process: lifecycle, single-instance lock, overlay window, global shortcut, clipboard read,
  settings persistence, data-pack loading + integrity check, About info.
- Preload: minimal typed `window.overlayApi` via `contextBridge`.
- Renderer hardening.
- Static enforcement of the runtime boundary.

## Out of scope

- UI beyond an empty host (006).
- Auto-update of app or data (SoT §6.7, §2.3); code signing (§19.4); telemetry (§15.3).

## Interfaces / contracts

### Process layout

```text
main (Node)                      preload (isolated)          renderer (React)
- overlay-window.ts              - exposes overlayApi        - parser + engine run here (pure TS)
- shortcuts.ts                   - no Node globals leaked    - never touches Node/Electron
- clipboard.ts (readText only)
- settings.ts (own typed JSON store in userData; SoT §4.1 allows electron-store, which is ESM-only)
- data-pack.ts (bundled pack, integrity check)
```

### IPC API (`src/preload/api-types.ts`)

```ts
interface OverlayApi {
  onClipboardSnapshot(cb: (snap: ClipboardSnapshot) => void): Unsubscribe; // pushed once per show
  readClipboard(): Promise<ClipboardSnapshot>;       // explicit "Read clipboard again"; never polled
  writeDebugReport(text: string): Promise<void>;     // explicit "Copy debug report" only

  getSettings(): Promise<AppSettings>;
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>;
  onSettingsChanged(cb: (s: AppSettings) => void): Unsubscribe;

  loadDataPack(): Promise<DataPackLoadResult>;
  getAppInfo(): Promise<AppInfo>;

  hideOverlay(): void;
  resetWindowPosition(): void;
  setHotkey(accelerator: string): Promise<HotkeyRegistrationResult>;
}

type DataPackLoadResult =
  | { ok: true; pack: DataPack }
  | { ok: false; code: 'DATA_PACK_MISSING' | 'DATA_PACK_INTEGRITY_FAILED' | 'DATA_PACK_NOT_VALIDATED' | 'DATA_PACK_SCHEMA_UNSUPPORTED' };

interface AppInfo {
  appVersion: string;                 // package.json semver
  platform: string;                   // process.platform
  dataManifest: DataManifestSummary | null;   // 005 type; null when the pack failed to load
}

interface ClipboardSnapshot { text: string; readAt: string }
type Unsubscribe = () => void;
type HotkeyRegistrationResult =
  | { ok: true; accelerator: string }
  | { ok: false; code: 'HOTKEY_REGISTRATION_FAILED' | 'HOTKEY_INVALID'; accelerator: string };
```

Channels are declared once in `src/shared/ipc-channels.ts`; main validates every payload
(types, size limits, e.g. debug report ≤ 256 KB).

### Data pack loading

- Only the bundled pack (`process.resourcesPath/data-pack` in production, repo path in dev).
- Checks: `schemaVersion` supported, recomputed sha256 equals `manifest.dataPackId`,
  `manifest.validated === true`. Any failure -> `ok: false`; the renderer shows a blocking,
  localized error and no craft workspace (SoT §0.2 rule 4). There is no fallback catalog.
- These `DATA_PACK_*` codes are the primary gate. 005's `DATA_CONFLICT` row is a defensive
  duplicate for callers that bypass 001 (tests, scripts); both codes are in the shared registry
  (005 "Code registry").
- No network access, no user-supplied pack path in MVP.

### Settings (`src/main/settings.ts`)

```ts
interface AppSettings {
  localization: LocalizationSettings;   // SoT §5.6; MVP values uiLocale 'en'|'pl', gameLocale 'en', clipboardLocale 'auto'|'en'
  hotkey: string;                       // default 'CommandOrControl+Shift+D' (SoT §16.1)
  closeOnBlur: boolean;                 // default false (SoT §16.3)
  showLegacyCurrencies: boolean;        // default false (SoT §2.2)
  showDataVersion: boolean;             // default true
  window: { x?: number; y?: number; width: number; height: number };   // default width 560
  onboardingCompleted: boolean;         // SoT §22.1
  settingsSchemaVersion: 1;
}
```

- First run: `uiLocale` from OS via 003 `resolveUiLocale` (Windows PL -> `pl`, otherwise `en`).
- The stored type is `string` validated at runtime against the 003/004 registries; the SoT §5.6
  literal unions are the MVP value sets, not hardcoded types. A new registered locale therefore
  needs no settings migration (SoT §5.10).
- Corrupt/unknown settings -> defaults, `.bak` kept.

### Overlay window, hotkey, hardening

- `frame: false`, `alwaysOnTop: true`, `skipTaskbar: true`, `resizable: true`, `show: false`.
  Always-on-top level chosen to stay above Windowed Fullscreen (candidate
  `setAlwaysOnTop(true, 'screen-saver')`); verified manually (SoT §19.3). Exclusive fullscreen
  unsupported (SoT §3.2).
- Bounds persisted (debounced); off-screen bounds reset to primary display.
- `closeOnBlur` hides on blur only when enabled. Close hides; quit via tray/menu.
- Hotkey toggle: hidden -> read clipboard once -> show + focus -> push snapshot; visible -> hide.
  Never sends keystrokes, synthesizes copy, or inspects other windows (SoT §3.1). Registration
  failure is reported, app keeps running with tray access.
- Renderer: `contextIsolation`, `sandbox`, no `nodeIntegration`, `webSecurity`; CSP
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'`;
  navigation and window-open denied.

### Runtime boundary enforcement

`tests/architecture/runtime-boundary.test.ts` fails on:

- imports of `child_process`, `robotjs`, `@nut-tree*`, `node-key-sender`, `ffi-napi`, `koffi`,
  `node-window-manager`, `active-win`, `ps-list`, `iohook`, `uiohook-napi`, and equivalents in
  `package.json`;
- `clipboard.writeText` outside the debug-report handler;
- `fetch(`, `net`, `http`, `https` in `src/main`, `src/renderer`, `src/domain`, `src/parser`
  (SoT §6.1);
- file reads outside app resources / userData.

### Public notice (SoT §3.3)

`about.gggNotice` in About and the footer; the EN wording is always shown verbatim in About.

## Algorithm/design choice

Reference design (SoT §4). Clarification: parser + engine run in the renderer because they are
pure TS (SoT §4.2) and this keeps IPC to raw text, settings and the pack.

## Acceptance criteria

1. Starts on Windows 10/11; second launch focuses the running instance.
2. `Ctrl+Shift+D` toggles; each show reads the clipboard exactly once; no polling.
3. Configurable hotkey; failure is a localized message.
4. Bounds survive restart; off-screen reset.
5. `closeOnBlur` defaults to `false`.
6. Renderer has no Node access.
7. A missing, tampered or unvalidated pack blocks the workspace with a localized error.
8. Boundary test passes; adding a forbidden import or API makes it fail.
9. GGG notice visible.

## Tests

- Unit: settings defaults/validation/corruption recovery, bounds check, accelerator validation,
  IPC validators, pack integrity (valid / missing / hash mismatch / `validated: false`).
- Architecture: runtime boundary.
- Manual desktop smoke (SoT §18.6, §19.3): 007.

## Dependencies

002 (pack + manifest), 003 and 004 (locale registries), 005 (`DataManifestSummary`, shared code
registry).

## Unresolved items

None of the U-items apply. Windowed-Fullscreen layering is a manual-validation item (SoT §19.3).
