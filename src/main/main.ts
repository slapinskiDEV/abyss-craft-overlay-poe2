// Electron main process (spec 001). Runtime path: user clipboard -> overlay (SoT §3.1).
import { app, dialog, ipcMain, type BrowserWindow, type Tray } from 'electron';
import type { AppInfo, AppSettings, ClipboardSnapshot, DataPackLoadResult, HotkeyRegistrationResult } from '../preload/api-types';
import { IPC } from '../shared/ipc-channels';
import { LATEST_CHANGELOG_ENTRY, pendingChangelog } from '../shared/changelog';
import { readClipboardSnapshot, writeDebugReportToClipboard } from './clipboard';
import { copyThenRead } from './copy-flow';
import { createAppUpdater } from './app-update';
import { sendCopyShortcut } from './copy-shortcut';
import { loadDataPackFile } from './data-pack-loader';
import { decideHotkeyAction } from './hotkey-action';
import { dataPackPath } from './resource-paths';
import { validAcceleratorPayload, validDebugReport } from './ipc-validation';
import { allowKeyboardFocus, centerOnPrimary, createOverlayWindow, releaseKeyboardFocus } from './overlay-window';
import { SettingsStore } from './settings';
import { registerToggleHotkey, unregisterAll } from './shortcuts';
import { createTray } from './tray';
import { UI_LOCALES } from '../i18n/ui/registry';
import { resolveUiLocale } from '../i18n/resolve-locale';

const uiResources = (locale: string) => (UI_LOCALES.find((l) => l.id === locale) ?? UI_LOCALES[0]).resources;

// A second copy exits at once, before it creates a window or tray or touches the settings file;
// the first copy shows its overlay (`second-instance`). `app.quit()` would still run `whenReady`
// (spec 017 A4).
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.exit(0);

let win: BrowserWindow | null = null;
/** Held for the app's lifetime: an unreferenced Tray can be garbage-collected (spec 017 A1). */
let tray: Tray | null = null;
let quitting = false;
let packResult: DataPackLoadResult | null = null;
/** Last snapshot pushed to the renderer; served to a renderer that subscribed late. */
let lastSnapshot: ClipboardSnapshot | null = null;
let autoCopyEnabled = (): boolean => false;
let hotkeyBusy = false;
let hotkeyStatus: HotkeyRegistrationResult | null = null;

const packPath = () => dataPackPath({ isPackaged: app.isPackaged, resourcesPath: process.resourcesPath, appPath: app.getAppPath() });

/**
 * `focus: false` (hotkey) keeps keyboard focus in the game, so the player's next Ctrl+C still
 * reaches PoE2 while the overlay stays visible (spec 009). The overlay takes focus when clicked.
 */
function deliver(target: BrowserWindow, snapshot: ClipboardSnapshot, focus: boolean): void {
  lastSnapshot = snapshot;
  if (focus) {
    target.show();
    target.focus();
  } else if (!target.isVisible()) target.showInactive();
  target.webContents.send(IPC.clipboardSnapshot, snapshot);
}

function showOverlay(): void {
  const target = win;
  if (!target) return;
  // Read exactly once per show (SoT §16.2), then show.
  void readClipboardSnapshot()
    .then((snapshot) => deliver(target, snapshot, true))
    .catch((error: unknown) => console.error('show: clipboard read failed', error));
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
/** Time for Windows to activate the game after the overlay hides. */
const REFOCUS_MS = 80;

// SoT §16.1: while visible, a newly copied item replaces the shown one instead of hiding. With
// auto-copy (SoT §3.1, spec 010) the hotkey first sends the game's copy shortcut once.
function toggle(): void {
  const target = win;
  if (!target || hotkeyBusy) return;
  const visible = target.isVisible();
  hotkeyBusy = true;
  // Pressed while the overlay has focus (e.g. after clicking a Bone): hide it so Windows hands focus
  // back to the game, then copy the hovered item there. Keys are never sent into our own window
  // (spec 010, SoT 0.2.9); the overlay reappears without focus when a new item was copied.
  const focused = visible && target.isFocused();
  if (focused) releaseKeyboardFocus(target);
  const refocus = focused ? (target.hide(), sleep(REFOCUS_MS)) : Promise.resolve();
  const busy = (on: boolean) => target.webContents.send(IPC.copyBusy, on);
  const read = refocus.then(() => {
    if (!autoCopyEnabled()) return readClipboardSnapshot();
    // Immediate feedback (spec 016): show the overlay without focus and a loading state while the
    // game copies the item.
    busy(true);
    if (!target.isVisible()) target.showInactive();
    return copyThenRead({ read: readClipboardSnapshot, sendCopy: sendCopyShortcut, sleep });
  });
  void read
    .then((snapshot) => {
      const action = decideHotkeyAction(visible, lastSnapshot?.text, snapshot.text);
      if (action === 'hide') target.hide();
      else deliver(target, snapshot, false);
    })
    // A failed read or a window closed during quit must not become an unhandled rejection (spec 017 A6).
    .catch((error: unknown) => console.error('hotkey: copy flow failed', error))
    .finally(() => {
      hotkeyBusy = false;
      busy(false);
    });
}

/** A startup error must not leave a process without window, tray or hotkey (spec 017 A3). */
function failStartup(error: unknown): void {
  console.error('startup failed', error);
  const common = uiResources(resolveUiLocale(app.getLocale())).common;
  dialog.showErrorBox(common.startupFailedTitle, `${common.startupFailedBody}\n\n${String(error)}`);
  app.exit(1);
}

app.whenReady().then(() => {
  if (!primaryInstance) return;
  const settings = new SettingsStore(app.getPath('userData'), app.getLocale());
  autoCopyEnabled = () => settings.get().autoCopy;
  // A fresh install starts with the current notes marked as read (spec 011).
  if (!settings.get().onboardingCompleted && settings.get().changelogSeen === null) settings.update({ changelogSeen: LATEST_CHANGELOG_ENTRY });
  win = createOverlayWindow({
    bounds: settings.get().window,
    closeOnBlur: () => settings.get().closeOnBlur,
    onBoundsChanged: (bounds) => settings.update({ window: bounds }),
    isQuitting: () => quitting,
  });
  const common = uiResources(settings.get().localization.uiLocale).common;
  const overlay = win;
  tray = createTray(
    { show: common.trayShow, resetPosition: common.trayResetPosition, quit: common.trayQuit },
    showOverlay,
    () => {
      centerOnPrimary(overlay);
      showOverlay();
    },
    () => {
      quitting = true;
      app.quit();
    },
  );
  hotkeyStatus = registerToggleHotkey(settings.get().hotkey, toggle);
  // A hotkey taken by another program at launch: open the overlay once so the player sees why and
  // can choose another one (spec 017 A7).
  if (!hotkeyStatus.ok) win.once('ready-to-show', showOverlay);
  // A renderer crash reloads the window instead of leaving it blank, at most a few times a minute
  // (spec 017 A5).
  const crashes: number[] = [];
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('renderer gone', details.reason);
    if (quitting || details.reason === 'clean-exit') return;
    const now = Date.now();
    while (crashes.length > 0 && now - (crashes[0] ?? now) > 60_000) crashes.shift();
    crashes.push(now);
    if (crashes.length <= 3) overlay.webContents.reload();
  });
  // Development: show the overlay right away; global hotkeys and tray icons are unreliable on some
  // Linux desktops (e.g. GNOME/Wayland). Packaged builds start hidden and wait for the hotkey.
  // After an update the overlay opens once so the player sees the release notes (spec 011).
  if (!app.isPackaged || pendingChangelog(settings.get().changelogSeen).length > 0) win.once('ready-to-show', showOverlay);

  const updater = createAppUpdater({
    enabled: () => settings.get().checkForUpdates,
    onStatus: (s) => win?.webContents.send(IPC.updateStatus, s),
    beforeInstall: () => {
      quitting = true;
    },
  });

  const broadcast = (s: AppSettings) => win?.webContents.send(IPC.settingsChanged, s);

  ipcMain.handle(IPC.readClipboard, async () => (lastSnapshot = await readClipboardSnapshot()));
  ipcMain.handle(IPC.getLastSnapshot, () => lastSnapshot);
  ipcMain.handle(IPC.writeDebugReport, (_e, text: unknown) => {
    if (!validDebugReport(text)) throw new Error('invalid debug report payload');
    return writeDebugReportToClipboard(text);
  });
  ipcMain.handle(IPC.getSettings, () => settings.get());
  ipcMain.handle(IPC.updateSettings, (_e, patch: unknown) => {
    const next = settings.update(patch);
    broadcast(next);
    return next;
  });
  ipcMain.handle(IPC.loadDataPack, () => (packResult ??= loadDataPackFile(packPath())));
  ipcMain.handle(IPC.getAppInfo, (): AppInfo => {
    const result = (packResult ??= loadDataPackFile(packPath()));
    const m = result.ok ? result.pack.manifest : null;
    return {
      appVersion: app.getVersion(),
      platform: process.platform,
      dataManifest: m && {
        dataPackId: m.dataPackId,
        schemaVersion: m.schemaVersion,
        targetGameVersion: m.targetGameVersion,
        repoeObservedVersion: m.repoeObservedVersion,
        generatedAt: m.generatedAt,
        validated: m.validated,
        stale: m.stale,
      },
    };
  });
  ipcMain.handle(IPC.getUpdateStatus, () => updater.status());
  ipcMain.handle(IPC.getHotkeyStatus, () => hotkeyStatus);
  ipcMain.on(IPC.startUpdate, () => updater.start());
  ipcMain.on(IPC.requestKeyboardFocus, () => win && allowKeyboardFocus(win));
  ipcMain.on(IPC.releaseKeyboardFocus, () => win && releaseKeyboardFocus(win));
  ipcMain.on(IPC.hideOverlay, () => win?.hide());
  ipcMain.on(IPC.resetWindowPosition, () => win && centerOnPrimary(win));
  ipcMain.handle(IPC.setHotkey, (_e, accelerator: unknown) => {
    if (!validAcceleratorPayload(accelerator)) return { ok: false, code: 'HOTKEY_INVALID', accelerator: String(accelerator) };
    const result = registerToggleHotkey(accelerator, toggle);
    if (result.ok) {
      hotkeyStatus = result;
      broadcast(settings.update({ hotkey: accelerator }));
    } else registerToggleHotkey(settings.get().hotkey, toggle); // keep the previous one
    return result;
  });
}).catch(failStartup);

app.on('second-instance', () => showOverlay());
app.on('before-quit', () => {
  quitting = true;
});
app.on('will-quit', () => unregisterAll());
app.on('window-all-closed', () => {
  // The overlay lives in the tray; closing the window only hides it.
});
