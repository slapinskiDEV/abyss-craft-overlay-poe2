// Electron main process (spec 001). Runtime path: user clipboard -> overlay (SoT §3.1).
import { app, dialog, ipcMain, shell, type BrowserWindow, type Tray } from 'electron';
import type { AppInfo, AppSettings, ClipboardSnapshot, CopyTiming, DataPackLoadResult, HotkeyRegistrationResult } from '../preload/api-types';
import { IPC } from '../shared/ipc-channels';
import { LATEST_CHANGELOG_ENTRY, pendingChangelog } from '../shared/changelog';
import { readClipboardSnapshot, writeDebugReportToClipboard } from './clipboard';
import { copyThenReadDetailed } from './copy-flow';
import { createAppUpdater } from './app-update';
import { clipboardSequenceNumber, sendCopyShortcut } from './copy-shortcut';
import { loadDataPackFile } from './data-pack-loader';
import { decideHotkeyAction } from './hotkey-action';
import { dataPackPath } from './resource-paths';
import { validAcceleratorPayload, validDebugReport, validDiag, validMoveDelta } from './ipc-validation';
import { allowKeyboardFocus, centerOnPrimary, createOverlayWindow, releaseKeyboardFocus } from './overlay-window';
import { SettingsStore } from './settings';
import { registerToggleHotkey, unregisterAll } from './shortcuts';
import { createTray } from './tray';
import { initLog, log } from './log';
import { join } from 'node:path';
import { UI_LOCALES } from '../i18n/ui/registry';
import { resolveUiLocale } from '../i18n/resolve-locale';

const uiResources = (locale: string) => (UI_LOCALES.find((l) => l.id === locale) ?? UI_LOCALES[0]).resources;

// A second copy exits at once, before it creates a window or tray or touches the settings file;
// the first copy shows its overlay (`second-instance`). `app.quit()` would still run `whenReady`
// (spec 017 A4).
const primaryInstance = app.requestSingleInstanceLock();
// Chromium's native window occlusion tracking could keep treating the overlay as hidden after it was
// hidden and shown again without focus over the fullscreen game, so the page stopped repainting and
// looked frozen (spec 018 follow-up 4). An always-on-top overlay gains nothing from it.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
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
/** Last hotkey copies, for the debug report (spec 018). */
const copyTimings: CopyTiming[] = [];

const packPath = () => dataPackPath({ isPackaged: app.isPackaged, resourcesPath: process.resourcesPath, appPath: app.getAppPath() });

/**
 * `focus: false` (hotkey) keeps keyboard focus in the game, so the player's next Ctrl+C still
 * reaches PoE2 while the overlay stays visible (spec 009). The overlay takes focus when clicked.
 */
function deliver(target: BrowserWindow, snapshot: ClipboardSnapshot, focus: boolean): void {
  lastSnapshot = snapshot;
  log('deliver', { focus, wasVisible: target.isVisible() });
  if (focus) {
    target.show();
    target.focus();
  } else if (!target.isVisible()) showWithoutFocus(target);
  target.webContents.send(IPC.clipboardSnapshot, snapshot);
}

/** Shows the overlay without taking focus from the game and forces a fresh frame (follow-up 4). */
function showWithoutFocus(target: BrowserWindow): void {
  target.showInactive();
  target.webContents.invalidate();
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
  log('hotkey', { visible, focused, autoCopy: autoCopyEnabled() });
  if (focused) releaseKeyboardFocus(target);
  const refocus = focused ? (target.hide(), sleep(REFOCUS_MS)) : Promise.resolve();
  const busy = (on: boolean) => target.webContents.send(IPC.copyBusy, on);
  const started = performance.now();
  let timing: (Pick<CopyTiming, 'clipboardChanged' | 'sendMs'> & { copied: boolean; showMs: number; waitMs: number; readMs: number; polls: number }) | null = null;
  let copyMissed = false;
  const read = refocus.then(async () => {
    if (!autoCopyEnabled()) return readClipboardSnapshot();
    // Immediate feedback (spec 016): show the overlay without focus and a loading state while the
    // game copies the item.
    busy(true);
    const showStart = performance.now();
    if (!target.isVisible()) showWithoutFocus(target);
    const showMs = Math.round(performance.now() - showStart);
    const result = await copyThenReadDetailed({ read: readClipboardSnapshot, sendCopy: sendCopyShortcut, sleep, sequence: clipboardSequenceNumber, now: () => performance.now() });
    timing = { clipboardChanged: result.changed, copied: result.copied, sendMs: Math.round(result.sendMs), showMs, waitMs: Math.round(result.waitMs), readMs: Math.round(result.readMs), polls: result.polls };
    copyMissed = result.sent && !result.copied;
    return result.snapshot;
  });
  void read
    .then((snapshot) => {
      const action = decideHotkeyAction(visible, lastSnapshot?.text, snapshot.text, copyMissed);
      log('hotkey:done', { action, ms: Math.round(performance.now() - started), ...(timing ?? {}) });
      if (timing) {
        copyTimings.push({ at: new Date().toISOString(), sendMs: timing.sendMs, totalMs: Math.round(performance.now() - started), clipboardChanged: timing.clipboardChanged, action });
        if (copyTimings.length > 10) copyTimings.shift();
      }
      if (action === 'hide') target.hide();
      else if (action === 'keep') target.webContents.send(IPC.copyMissed, true);
      else {
        deliver(target, snapshot, false);
        target.webContents.send(IPC.copyMissed, copyMissed);
      }
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
  const logDir = initLog(join(app.getPath('userData'), 'logs'));
  log('start', { version: app.getVersion(), platform: process.platform });
  // Main-thread stalls: while it is blocked the overlay cannot handle clicks or the hotkey.
  let tick = performance.now();
  setInterval(() => {
    const now = performance.now();
    const lag = now - tick - 250;
    if (lag > 300) log('main:lag', { ms: Math.round(lag) });
    tick = now;
  }, 250).unref();
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
    { show: common.trayShow, resetPosition: common.trayResetPosition, reload: common.trayReload, openLogs: common.trayOpenLogs, quit: common.trayQuit },
    {
      show: showOverlay,
      resetPosition: () => {
        centerOnPrimary(overlay);
        showOverlay();
      },
      reload: () => {
        log('tray:reload');
        releaseKeyboardFocus(overlay);
        overlay.webContents.reload();
        showOverlay();
      },
      openLogs: () => void shell.openPath(logDir),
      quit: () => {
        quitting = true;
        app.quit();
      },
    },
  );
  hotkeyStatus = registerToggleHotkey(settings.get().hotkey, toggle);
  log('hotkey:register', { ok: hotkeyStatus.ok, accelerator: hotkeyStatus.accelerator });
  // A hotkey taken by another program at launch: open the overlay once so the player sees why and
  // can choose another one (spec 017 A7).
  if (!hotkeyStatus.ok) win.once('ready-to-show', showOverlay);
  // A renderer crash reloads the window instead of leaving it blank, at most a few times a minute
  // (spec 017 A5).
  const crashes: number[] = [];
  // A hung renderer (Windows: "not responding") is restarted; the reload below brings it back.
  win.on('unresponsive', () => {
    log('renderer:unresponsive');
    overlay.webContents.forcefullyCrashRenderer();
  });
  win.on('responsive', () => log('renderer:responsive'));
  win.on('show', () => log('window:show'));
  win.on('hide', () => log('window:hide'));
  win.webContents.on('render-process-gone', (_event, details) => {
    log('renderer:gone', { reason: details.reason });
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
  ipcMain.handle(IPC.getCopyTimings, () => copyTimings);
  // Renderer liveness and input (spec 018): a heartbeat every 2 s with its own timer lag, and each
  // pointer press that reached the page (at most one per second). Logged locally only.
  let lastBeat = performance.now();
  let beatGapLogged = false;
  ipcMain.on(IPC.diag, (_e, event: unknown, ms: unknown) => {
    if (!validDiag(event, ms)) return;
    if (event === 'pointerdown') return log('renderer:pointerdown');
    // 1 = the page thinks it is visible, 0 = hidden; hidden while the window is shown means the page
    // stopped painting (follow-up 4).
    if (event === 'visibility') return log('renderer:visibility', { visible: ms === 1, windowVisible: win?.isVisible() ?? false });
    lastBeat = performance.now();
    beatGapLogged = false;
    const lag = ms as number;
    if (lag > 300) log('renderer:lag', { ms: Math.round(lag) });
  });
  setInterval(() => {
    if (!win?.isVisible() || beatGapLogged) return;
    const gap = performance.now() - lastBeat;
    if (gap > 5000) {
      beatGapLogged = true;
      log('renderer:silent', { ms: Math.round(gap) });
    }
  }, 1000).unref();
  // Title-bar drag in JS (spec 018): an OS drag region in a non-focusable window swallowed clicks on
  // the title-bar buttons and froze the overlay on Windows.
  ipcMain.on(IPC.moveWindowBy, (_e, dx: unknown, dy: unknown) => {
    if (!win || !validMoveDelta(dx, dy)) return;
    const [x = 0, y = 0] = win.getPosition();
    win.setPosition(x + (dx as number), y + (dy as number));
  });
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
