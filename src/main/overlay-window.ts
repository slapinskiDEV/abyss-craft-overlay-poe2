// Frameless always-on-top overlay window (SoT §16.3, spec 001).
import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import type { WindowBounds } from '../preload/api-types';
import { appIcon } from './app-icon-image';
import { log } from './log';
import { restoreBounds } from './window-bounds';

export interface OverlayWindowOptions {
  bounds: WindowBounds;
  closeOnBlur: () => boolean;
  onBoundsChanged: (bounds: WindowBounds) => void;
  isQuitting: () => boolean;
}

/** Windows only: other desktops may never give an unfocusable window any input. */
const KEEPS_GAME_FOCUS = process.platform === 'win32';

/** Lets the player type in a text field of the overlay (search, level filters, settings). */
export function allowKeyboardFocus(win: BrowserWindow): void {
  if (!KEEPS_GAME_FOCUS) return;
  log('focus:allow');
  win.setFocusable(true);
  win.focus();
}

/** Typing finished: stop taking focus again; the next click in the game gives it back. */
export function releaseKeyboardFocus(win: BrowserWindow): void {
  if (!KEEPS_GAME_FOCUS) return;
  log('focus:release', { focused: win.isFocused() });
  win.setFocusable(false);
}

export function createOverlayWindow(options: OverlayWindowOptions): BrowserWindow {
  const displays = screen.getAllDisplays().map((d) => d.workArea);
  const bounds = restoreBounds(options.bounds, displays, screen.getPrimaryDisplay().workArea);
  const win = new BrowserWindow({
    ...bounds,
    minWidth: 360,
    minHeight: 240,
    frame: false,
    show: false,
    skipTaskbar: true,
    resizable: true,
    alwaysOnTop: true,
    backgroundColor: '#15161a',
    // SoT §16.3 (0.2.12): on Windows the overlay never takes keyboard focus from the game, so
    // clicking a Bone keeps the game focused and the next hotkey copy reaches it. Text fields ask
    // for focus while the player types (allowKeyboardFocus).
    focusable: !KEEPS_GAME_FOCUS,
    icon: appIcon(32),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      // The overlay is often hidden or unfocused; throttled timers and frames made a new item
      // appear 1–2 s late (spec 016).
      backgroundThrottling: false,
    },
  });
  // Stay above Windowed Fullscreen PoE2 (SoT §3.2); verified manually (SoT §19.3).
  win.setAlwaysOnTop(true, 'screen-saver');

  let timer: NodeJS.Timeout | undefined;
  const persist = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const b = win.getBounds();
      options.onBoundsChanged({ x: b.x, y: b.y, width: b.width, height: b.height });
    }, 400);
  };
  win.on('move', persist);
  win.on('resize', persist);
  win.on('blur', () => {
    if (options.closeOnBlur()) win.hide();
  });
  win.on('close', (event) => {
    if (!options.isQuitting()) {
      event.preventDefault();
      win.hide();
    }
  });
  // No navigation or new windows at runtime (spec 001 hardening).
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void win.loadFile(join(__dirname, '../renderer/index.html'));
  return win;
}

export function centerOnPrimary(win: BrowserWindow): void {
  const primary = screen.getPrimaryDisplay().workArea;
  const b = win.getBounds();
  win.setBounds(restoreBounds({ width: b.width, height: b.height }, [], primary));
}
