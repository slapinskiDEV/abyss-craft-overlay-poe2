// Preload: the only bridge between renderer and main. Exposes a typed, minimal API (spec 001).
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from '../shared/ipc-channels';
import type { AppSettings, ClipboardSnapshot, OverlayApi, UpdateStatus } from './api-types';

const subscribe = <T>(channel: string, cb: (value: T) => void) => {
  const listener = (_e: IpcRendererEvent, value: T) => cb(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

const api: OverlayApi = {
  onClipboardSnapshot: (cb) => subscribe<ClipboardSnapshot>(IPC.clipboardSnapshot, cb),
  readClipboard: () => ipcRenderer.invoke(IPC.readClipboard),
  getLastSnapshot: () => ipcRenderer.invoke(IPC.getLastSnapshot),
  writeDebugReport: (text) => ipcRenderer.invoke(IPC.writeDebugReport, text),
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  updateSettings: (patch) => ipcRenderer.invoke(IPC.updateSettings, patch),
  onSettingsChanged: (cb) => subscribe<AppSettings>(IPC.settingsChanged, cb),
  loadDataPack: () => ipcRenderer.invoke(IPC.loadDataPack),
  getAppInfo: () => ipcRenderer.invoke(IPC.getAppInfo),
  hideOverlay: () => ipcRenderer.send(IPC.hideOverlay),
  resetWindowPosition: () => ipcRenderer.send(IPC.resetWindowPosition),
  setHotkey: (accelerator) => ipcRenderer.invoke(IPC.setHotkey, accelerator),
  getUpdateStatus: () => ipcRenderer.invoke(IPC.getUpdateStatus),
  onUpdateStatus: (cb) => subscribe<UpdateStatus>(IPC.updateStatus, cb),
  startUpdate: () => ipcRenderer.send(IPC.startUpdate),
  onCopyBusy: (cb) => subscribe<boolean>(IPC.copyBusy, cb),
  requestKeyboardFocus: () => ipcRenderer.send(IPC.requestKeyboardFocus),
  releaseKeyboardFocus: () => ipcRenderer.send(IPC.releaseKeyboardFocus),
  getHotkeyStatus: () => ipcRenderer.invoke(IPC.getHotkeyStatus),
};

contextBridge.exposeInMainWorld('overlayApi', api);
