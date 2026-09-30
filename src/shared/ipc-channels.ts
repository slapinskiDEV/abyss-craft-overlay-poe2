// Single declaration of every IPC channel (spec 001).
export const IPC = {
  clipboardSnapshot: 'overlay:clipboard-snapshot', // main -> renderer push, once per show
  readClipboard: 'overlay:read-clipboard',
  getLastSnapshot: 'overlay:get-last-snapshot', // cached snapshot, never a new read
  writeDebugReport: 'overlay:write-debug-report',
  getSettings: 'overlay:get-settings',
  updateSettings: 'overlay:update-settings',
  settingsChanged: 'overlay:settings-changed',
  loadDataPack: 'overlay:load-data-pack',
  getAppInfo: 'overlay:get-app-info',
  hideOverlay: 'overlay:hide',
  resetWindowPosition: 'overlay:reset-window-position',
  setHotkey: 'overlay:set-hotkey',
  getUpdateStatus: 'overlay:get-update-status',
  updateStatus: 'overlay:update-status', // main -> renderer push
  startUpdate: 'overlay:start-update',
  copyBusy: 'overlay:copy-busy', // main -> renderer push: hotkey copy in progress (spec 016)
  requestKeyboardFocus: 'overlay:request-keyboard-focus', // text field pressed (spec 015)
  releaseKeyboardFocus: 'overlay:release-keyboard-focus',
  getHotkeyStatus: 'overlay:get-hotkey-status', // last registration result (spec 017 A7)
} as const;

export const DEBUG_REPORT_MAX_BYTES = 256 * 1024;
