// Tray entry point: reachable even if the hotkey could not be registered (spec 001).
import { Menu, Tray } from 'electron';
import { appIcon } from './app-icon-image';

export function createTray(labels: { show: string; resetPosition: string; quit: string }, onShow: () => void, onResetPosition: () => void, onQuit: () => void): Tray {
  const tray = new Tray(appIcon(16));
  tray.setToolTip('PoE2 Abyss Craft Overlay');
  // Reset position here too: an overlay moved off-screen (monitor removed) is unreachable otherwise (spec 017 A8).
  tray.setContextMenu(
    Menu.buildFromTemplate([{ label: labels.show, click: onShow }, { label: labels.resetPosition, click: onResetPosition }, { type: 'separator' }, { label: labels.quit, click: onQuit }]),
  );
  tray.on('click', onShow);
  return tray;
}
