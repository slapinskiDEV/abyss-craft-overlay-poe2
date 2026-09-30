// App update (SoT §3.5, 0.2.8, spec 011): the only network access at runtime. Checks the public
// releases repository for a newer version; downloads and installs only when the player clicks.
// Nothing about the player, the item or the game is sent.
import { app, shell } from 'electron';
import electronUpdater from 'electron-updater';
import type { UpdateStatus } from '../preload/api-types';

export const RELEASES_REPO = 'slapinskiDEV/abyss-craft-overlay-poe2-releases';
const FEED_URL = `https://github.com/${RELEASES_REPO}/releases/latest/download`;
const RELEASES_PAGE = `https://github.com/${RELEASES_REPO}/releases/latest`;
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const FIRST_CHECK_MS = 15 * 1000;

export interface AppUpdater {
  status(): UpdateStatus;
  start(): void;
}

/** The portable build runs from a temporary copy and cannot replace itself. */
const isPortable = () => Boolean(process.env.PORTABLE_EXECUTABLE_DIR);

export function createAppUpdater(opts: { enabled: () => boolean; onStatus: (s: UpdateStatus) => void; beforeInstall: () => void }): AppUpdater {
  let status: UpdateStatus = { state: 'none' };
  const set = (s: UpdateStatus) => {
    status = s;
    opts.onStatus(s);
  };
  // Only the packaged Windows build updates; dev and other platforms stay offline.
  if (!app.isPackaged || process.platform !== 'win32') return { status: () => status, start: () => undefined };

  const { autoUpdater } = electronUpdater;
  autoUpdater.setFeedURL({ provider: 'generic', url: FEED_URL });
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on('update-available', (info) => set({ state: 'available', version: info.version, manual: isPortable() }));
  const mb = (bytes: number) => Math.round(bytes / 1048576);
  autoUpdater.on('download-progress', (p) => {
    if (status.state === 'downloading') set({ ...status, doneMb: mb(p.transferred), totalMb: mb(p.total) });
  });
  autoUpdater.on('update-downloaded', (info) => {
    set({ state: 'ready', version: info.version });
    opts.beforeInstall();
    autoUpdater.quitAndInstall(true, true); // silent install into the same folder, then restart
  });
  autoUpdater.on('error', () => {
    // A failed check (offline, no release yet) is silent; a failed download is shown.
    if (status.state === 'downloading') set({ state: 'failed' });
  });

  const check = () => {
    if (opts.enabled() && status.state === 'none') void autoUpdater.checkForUpdates().catch(() => undefined);
  };
  setTimeout(check, FIRST_CHECK_MS);
  setInterval(check, CHECK_EVERY_MS);

  return {
    status: () => status,
    start: () => {
      if (status.state === 'available' && status.manual) void shell.openExternal(RELEASES_PAGE);
      else if (status.state === 'available' || status.state === 'failed') {
        const version = status.state === 'available' ? status.version : '';
        set({ state: 'downloading', version, doneMb: 0, totalMb: 0 });
        void autoUpdater.downloadUpdate().catch(() => set({ state: 'failed' }));
      }
    },
  };
}
