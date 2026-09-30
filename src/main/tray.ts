// Tray entry point: reachable even if the hotkey could not be registered (spec 001).
import { Menu, Tray } from 'electron';
import { appIcon } from './app-icon-image';

export function createTray(labels: { show: string; quit: string }, onShow: () => void, onQuit: () => void): Tray {
  const tray = new Tray(appIcon(16));
  tray.setToolTip('PoE2 Abyss Craft Overlay');
  tray.setContextMenu(Menu.buildFromTemplate([{ label: labels.show, click: onShow }, { type: 'separator' }, { label: labels.quit, click: onQuit }]));
  tray.on('click', onShow);
  return tray;
}
