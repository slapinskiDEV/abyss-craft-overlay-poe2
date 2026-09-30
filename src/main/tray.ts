// Tray entry point: reachable even if the hotkey could not be registered (spec 001).
import { Menu, Tray } from 'electron';
import { appIcon } from './app-icon-image';

export interface TrayActions {
  show: () => void;
  resetPosition: () => void;
  /** Escape hatch when the overlay stops reacting (spec 018). */
  reload: () => void;
  openLogs: () => void;
  quit: () => void;
}

export function createTray(labels: { show: string; resetPosition: string; reload: string; openLogs: string; quit: string }, actions: TrayActions): Tray {
  const tray = new Tray(appIcon(16));
  tray.setToolTip('PoE2 Abyss Craft Overlay');
  // Reset position here too: an overlay moved off-screen (monitor removed) is unreachable otherwise (spec 017 A8).
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: labels.show, click: actions.show },
      { label: labels.resetPosition, click: actions.resetPosition },
      { label: labels.reload, click: actions.reload },
      { type: 'separator' },
      { label: labels.openLogs, click: actions.openLogs },
      { type: 'separator' },
      { label: labels.quit, click: actions.quit },
    ]),
  );
  tray.on('click', actions.show);
  return tray;
}
