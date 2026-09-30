import { act, configure, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/renderer/features/App';
import type { ParseFn } from '../../src/renderer/features/Workspace';
import type { AppSettings, ClipboardSnapshot, DataPackLoadResult, HotkeyRegistrationResult, OverlayApi, UpdateStatus } from '../../src/preload/api-types';
import { LATEST_CHANGELOG_ENTRY } from '../../src/shared/changelog';
import type { ParsedItem } from '../../src/parser/common/types';
import { defaultSettings } from '../../src/main/settings-model';
import { ENGINE_PACK, affix, parsed } from '../fixtures/data/test-only-engine-pack';

// Under the full parallel suite a render can take longer than the 1 s default.
configure({ asyncUtilTimeout: 10000 });
afterEach(cleanup);

function fakeApi(overrides: { pack?: DataPackLoadResult; settings?: Partial<AppSettings>; update?: UpdateStatus; hotkey?: HotkeyRegistrationResult } = {}) {
  let settings: AppSettings = { ...defaultSettings('en-US'), onboardingCompleted: true, changelogSeen: LATEST_CHANGELOG_ENTRY, ...overrides.settings };
  const settingsListeners: Array<(s: AppSettings) => void> = [];
  const clipboardListeners: Array<(s: ClipboardSnapshot) => void> = [];
  const busyListeners: Array<(b: boolean) => void> = [];
  // Like main (spec 009): the last pushed snapshot is served to a renderer that subscribed late, so
  // a push that races the subscription on a slow runner is not lost.
  let lastSnapshot: ClipboardSnapshot | null = null;
  const api: OverlayApi = {
    onClipboardSnapshot: (cb) => (clipboardListeners.push(cb), () => undefined),
    readClipboard: async () => ({ text: '', readAt: '' }),
    getLastSnapshot: async () => lastSnapshot,
    writeDebugReport: vi.fn(async () => undefined),
    getSettings: async () => settings,
    updateSettings: async (patch) => {
      settings = { ...settings, ...patch, localization: { ...settings.localization, ...patch.localization } };
      for (const l of settingsListeners) l(settings);
      return settings;
    },
    onSettingsChanged: (cb) => (settingsListeners.push(cb), () => undefined),
    loadDataPack: async () => overrides.pack ?? { ok: true, pack: ENGINE_PACK },
    getAppInfo: async () => ({ appVersion: '0.0.0', platform: 'test', dataManifest: null }),
    hideOverlay: vi.fn(),
    resetWindowPosition: vi.fn(),
    setHotkey: async (a) => ({ ok: true, accelerator: a }),
    getUpdateStatus: async () => overrides.update ?? { state: 'none' },
    onUpdateStatus: () => () => undefined,
    startUpdate: vi.fn(),
    onCopyBusy: (cb) => (busyListeners.push(cb), () => undefined),
    requestKeyboardFocus: vi.fn(),
    releaseKeyboardFocus: vi.fn(),
    getHotkeyStatus: async () => overrides.hotkey ?? { ok: true, accelerator: settings.hotkey },
    moveWindowBy: vi.fn(),
    getCopyTimings: async () => [],
  };
  return { api, pushClipboard: (text: string) => {
      lastSnapshot = { text, readAt: '' };
      clipboardListeners.forEach((l) => l({ text, readAt: '' }));
    }, pushBusy: (b: boolean) => busyListeners.forEach((l) => l(b)) };
}

const parseAs = (item: ParsedItem, confidence: 'full' | 'partial' = 'full'): ParseFn => (raw) =>
  raw === '' ? { ok: false, confidence: 'insufficient', diagnostics: [{ code: 'NOT_A_POE2_ITEM', severity: 'error' }] } : { ok: true, item, confidence, diagnostics: [] };

async function mount(item: ParsedItem, opts: Parameters<typeof fakeApi>[0] = {}, confidence: 'full' | 'partial' = 'full') {
  const f = fakeApi(opts);
  render(<App api={f.api} parseOverride={parseAs(item, confidence)} />);
  await screen.findByRole('button', { name: 'Copy debug report' });
  act(() => f.pushClipboard('TEST_ONLY copied item'));
  // Wait until the item and its default choices (spec 014) are rendered, so synchronous queries
  // below do not race the first render under a busy parallel run.
  // Role queries over the full modifier list are slow in jsdom; wait on the element itself.
  if (opts.pack?.ok !== false) await waitFor(() => expect(document.querySelector('.item-preview')).not.toBeNull());
  await act(async () => undefined);
  return f;
}
// Selects a Bone; a Bone already chosen by default (spec 014) is left selected, not toggled off.
const controls = () => within(document.querySelector('.controls') as HTMLElement);
const chooseBone = (id: string) => {
  const radio = controls().getByRole('radio', { name: `${id}_NAME` });
  if (radio.getAttribute('aria-checked') !== 'true') fireEvent.click(radio);
};
const boneGroup = (name = 'Currency') => screen.getByRole('radiogroup', { name });

const armour = parsed('armour', [affix('TEST_ONLY_MOD_ARMOUR_P1'), affix('TEST_ONLY_MOD_ARMOUR_S1')]);

describe('overlay UI (spec 006)', () => {
  it('shows a blocking error and no workspace when the pack fails to load', async () => {
    render(<App api={fakeApi({ pack: { ok: false, code: 'DATA_PACK_NOT_VALIDATED' } }).api} />);
    expect((await screen.findByRole('alert')).textContent).toContain('Crafting data is not validated');
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('offers Bones from the pack and only compatible ones by default', async () => {
    await mount(armour);
    const options = within(boneGroup()).getAllByRole('radio').map((o) => o.textContent);
    expect(options).toEqual(['TEST_ONLY_BONE_ARMOUR_PLAIN_NAME', 'TEST_ONLY_BONE_ARMOUR_HIGH_NAME']);
  });

  it('shows the eligible modifier pool heading only for a final pool', async () => {
    await mount(armour);
    chooseBone('TEST_ONLY_BONE_ARMOUR_PLAIN');
    expect(await screen.findByRole('heading', { name: 'Eligible modifier pool' })).toBeTruthy();
    expect(screen.getByText('Valid')).toBeTruthy();
  });

  it('labels a partial parse as not final (SoT §18.3 #24)', async () => {
    await mount(armour, {}, 'partial');
    chooseBone('TEST_ONLY_BONE_ARMOUR_PLAIN');
    expect(await screen.findByRole('heading', { name: 'Base eligibility (not final)' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Eligible modifier pool' })).toBeNull();
  });

  it('shows the base pool, never as the eligible pool, when the exact check is unknown (spec 009)', async () => {
    await mount(parsed('armour', ['P1', 'P2', 'P3'].map((s) => affix(`TEST_ONLY_MOD_ARMOUR_${s}`))));
    chooseBone('TEST_ONLY_BONE_ARMOUR_PLAIN');
    expect(await screen.findByRole('heading', { name: 'Possible modifiers for this base' })).toBeTruthy();
    expect(screen.getByText(/current modifiers are not taken into account/)).toBeTruthy();
    // SoT §14.7 (0.2.7): the unknown exact check is not displayed next to the base pool.
    expect(screen.queryByText('Unknown')).toBeNull();
    expect(screen.queryByText('Exact item check')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Eligible modifier pool' })).toBeNull();
    expect(screen.queryByText(/eligible$/)).toBeNull();
    // Prefixes are full, so the side filter starts on suffixes only, with the U-012 note (spec 014).
    expect(screen.getByRole('button', { name: 'Suffix' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Prefix' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText(/only this side has a free slot/)).toBeTruthy();
    // Existing modifiers are not considered by the base pool: P1 is listed although it is on the item.
    fireEvent.click(screen.getByRole('button', { name: 'Prefix' }));
    expect(document.querySelector('[data-modifier-id="TEST_ONLY_MOD_ARMOUR_P1"]')).not.toBeNull();
    expect(screen.queryByRole('tab', { name: 'This item' })).toBeNull();
  });

  it('renders no list at all for an evidenced invalid craft', async () => {
    await mount({ ...armour, corrupted: true });
    chooseBone('TEST_ONLY_BONE_ARMOUR_PLAIN');
    expect(await screen.findByText('Invalid')).toBeTruthy();
    expect(document.querySelector('.rows')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Possible modifiers for this base' })).toBeNull();
  });

  it('switches between the exact item pool and the base pool', async () => {
    await mount(armour);
    chooseBone('TEST_ONLY_BONE_ARMOUR_PLAIN');
    await screen.findByRole('heading', { name: 'Eligible modifier pool' });
    fireEvent.click(screen.getByRole('tab', { name: 'Base pool' }));
    expect(screen.getByRole('heading', { name: 'Possible modifiers for this base' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'This item' }));
    expect(screen.getByRole('heading', { name: 'Eligible modifier pool' })).toBeTruthy();
  });

  it('shows a newly pushed item instead of the previous one and resets the pool view', async () => {
    const f = await mount(armour);
    chooseBone('TEST_ONLY_BONE_ARMOUR_PLAIN');
    fireEvent.click(await screen.findByRole('tab', { name: 'Base pool' }));
    act(() => f.pushClipboard('TEST_ONLY another copied item'));
    expect(screen.getByRole('heading', { name: 'Eligible modifier pool' })).toBeTruthy();
  });

  it('serves a snapshot that arrived before the workspace subscribed', async () => {
    const f = fakeApi();
    f.api.getLastSnapshot = async () => ({ text: 'TEST_ONLY early copy', readAt: '' });
    render(<App api={f.api} parseOverride={parseAs(armour)} />);
    expect(await screen.findByRole('radiogroup', { name: 'Currency' })).toBeTruthy();
  });

  it('reads the clipboard on Ctrl+V', async () => {
    const f = await mount(armour);
    const read = vi.fn(async () => ({ text: 'TEST_ONLY pasted item', readAt: '' }));
    f.api.readClipboard = read;
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  });

  it('hides the overlay on Escape', async () => {
    const { api } = await mount(armour);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(api.hideOverlay).toHaveBeenCalledTimes(1);
  });

  it('hides Omens that cannot be used with the chosen Bone (SoT §16.4, 0.2.9)', async () => {
    await mount(armour);
    chooseBone('TEST_ONLY_BONE_ARMOUR_PLAIN');
    expect(screen.queryByRole('button', { name: 'TEST_ONLY_OMEN_FORCE_LICH_A_NAME' })).toBeNull();
    expect(screen.getByRole('button', { name: 'TEST_ONLY_OMEN_FORCE_SUFFIX_NAME' })).toBeTruthy();
  });

  it('shows the free prefix and suffix slots of the copied item', async () => {
    await mount(armour);
    const preview = await screen.findByRole('region', { name: 'Item preview' });
    expect(within(preview).getByText('2 prefixes')).toBeTruthy();
    expect(within(preview).getByText('2 suffixes')).toBeTruthy();
  });

  it('previews a picked modifier on the item and clears it on a second click', async () => {
    await mount(armour);
    chooseBone('TEST_ONLY_BONE_ARMOUR_PLAIN');
    await screen.findByRole('heading', { name: 'Eligible modifier pool' });
    const row = document.querySelector('.rows li[role="button"]') as HTMLElement;
    const text = row.querySelector('.text')?.textContent ?? '';
    fireEvent.click(row);
    const preview = screen.getByRole('region', { name: 'Item preview' });
    expect(within(preview).getByText('Desecrated · preview').parentElement?.textContent).toContain(text);
    fireEvent.click(row);
    expect(within(preview).queryByText('Desecrated · preview')).toBeNull();
  });

  it('changes the visible pool with the branch selector', async () => {
    await mount(armour);
    chooseBone('TEST_ONLY_BONE_ARMOUR_PLAIN');
    await screen.findByRole('heading', { name: 'Eligible modifier pool' });
    const ids = () => [...document.querySelectorAll('.rows li')].map((li) => li.getAttribute('data-modifier-id'));
    const prefixRows = ids();
    fireEvent.click(screen.getByRole('tab', { name: 'Open Suffix slot' }));
    expect(ids()).not.toEqual(prefixRows);
  });

  it('shows a reason on blocked rows', async () => {
    await mount(armour);
    chooseBone('TEST_ONLY_BONE_ARMOUR_PLAIN');
    fireEvent.click(await screen.findByRole('tab', { name: 'Open Suffix slot' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Blocked' }));
    const row = document.querySelector('[data-modifier-id="TEST_ONLY_MOD_ARMOUR_S1"]');
    expect(row?.querySelector('.reason')?.textContent).toBe('Blocked by an existing modifier');
  });

  it('copies the debug report without clipboard text unless opted in', async () => {
    const { api } = await mount(armour);
    fireEvent.click(screen.getByText('Copy debug report', { selector: 'summary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy debug report' }));
    await waitFor(() => expect(api.writeDebugReport).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.writeDebugReport).mock.calls[0]?.[0]).not.toContain('TEST_ONLY copied item');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include copied item text' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy debug report' }));
    await waitFor(() => expect(api.writeDebugReport).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.writeDebugReport).mock.calls[1]?.[0]).toContain('TEST_ONLY copied item');
  });

  it('switches EN -> PL live without losing the workspace state; game terms stay English', async () => {
    const { api } = await mount(armour);
    chooseBone('TEST_ONLY_BONE_ARMOUR_PLAIN');
    await screen.findByRole('heading', { name: 'Eligible modifier pool' });
    await act(async () => {
      await api.updateSettings({ localization: { uiLocale: 'pl', gameLocale: 'en', clipboardLocale: 'auto' } });
    });
    expect(await screen.findByRole('heading', { name: 'Pula dostępnych modyfikatorów' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'TEST_ONLY_OMEN_FORCE_SUFFIX_NAME' })).toBeTruthy();
    expect(within(boneGroup('Waluta')).getByRole('radio', { checked: true }).textContent).toBe('TEST_ONLY_BONE_ARMOUR_PLAIN_NAME');
  });

  it('always shows the GGG notice', async () => {
    await mount(armour);
    expect(screen.getByText("This product isn't affiliated with or endorsed by Grinding Gear Games in any way.")).toBeTruthy();
  });
});

describe('title bar without an OS drag region (spec 018)', () => {
  it('opens the settings and closes the overlay with the title-bar buttons', async () => {
    const f = await mount(armour);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('button', { name: 'Settings' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(f.api.hideOverlay).toHaveBeenCalled();
  });

  it('moves the window by the pointer delta while the title is dragged', async () => {
    const f = await mount(armour);
    const title = document.querySelector('.titlebar .drag') as HTMLElement;
    title.setPointerCapture = () => undefined;
    title.hasPointerCapture = () => true;
    title.releasePointerCapture = () => undefined;
    fireEvent.pointerDown(title, { button: 0, screenX: 100, screenY: 100, pointerId: 1 });
    fireEvent.pointerMove(title, { screenX: 130, screenY: 90, pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(title, { pointerId: 1 });
    fireEvent.pointerMove(title, { screenX: 200, screenY: 200, pointerId: 1, buttons: 1 });
    // A drag cut short by the window losing focus sends no further moves.
    fireEvent.pointerDown(title, { button: 0, screenX: 0, screenY: 0, pointerId: 2 });
    fireEvent.blur(window);
    fireEvent.pointerMove(title, { screenX: 50, screenY: 50, pointerId: 2, buttons: 1 });
    expect(f.api.moveWindowBy).toHaveBeenCalledTimes(1);
    expect(f.api.moveWindowBy).toHaveBeenCalledWith(30, -10);
  });
});

describe('startup failure (spec 017 B4)', () => {
  it('shows an error instead of an empty window when a startup call fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const f = fakeApi();
      f.api.getSettings = async () => {
        throw new Error('TEST_ONLY settings IPC failed');
      };
      render(<App api={f.api} />);
      expect(await screen.findByRole('alert')).toBeTruthy();
      expect(screen.getByText(/could not start/)).toBeTruthy();
    } finally {
      error.mockRestore();
    }
  });
});

describe('hotkey taken at startup (spec 017 A7)', () => {
  it('shows which hotkey could not be registered', async () => {
    await mount(armour, { hotkey: { ok: false, code: 'HOTKEY_REGISTRATION_FAILED', accelerator: 'Alt+T' } });
    expect(await screen.findByText('The hotkey Alt+T is already in use. Choose another one.')).toBeTruthy();
  });

  it('shows nothing when the hotkey is registered', async () => {
    await mount(armour);
    expect(screen.queryByText(/is already in use/)).toBeNull();
  });
});

describe('render errors (spec 017 B1)', () => {
  it('shows a fallback instead of a blank overlay, and the next item restores the workspace', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const f = fakeApi();
      const parse: ParseFn = (raw, locale) => {
        if (raw === 'TEST_ONLY broken item') throw new Error('TEST_ONLY parse failure');
        return parseAs(armour)(raw, locale);
      };
      render(<App api={f.api} parseOverride={parse} />);
      await screen.findByRole('button', { name: 'Copy debug report' });
      act(() => f.pushClipboard('TEST_ONLY broken item'));
      expect(await screen.findByText('Something went wrong with this item')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Copy debug report' }));
      await waitFor(() => expect(f.api.writeDebugReport).toHaveBeenCalledWith(expect.stringContaining('TEST_ONLY parse failure')));
      expect(vi.mocked(f.api.writeDebugReport).mock.calls[0]?.[0]).not.toContain('TEST_ONLY broken item');
      act(() => f.pushClipboard('TEST_ONLY good item'));
      await waitFor(() => expect(document.querySelector('.item-preview')).not.toBeNull());
      expect(screen.queryByText('Something went wrong with this item')).toBeNull();
    } finally {
      error.mockRestore();
    }
  });
});

describe('app update and release notes (spec 011)', () => {
  it('shows the release notes after an update in the UI language, once', async () => {
    const { api } = fakeApi({ settings: { changelogSeen: null } });
    render(<App api={api} parseOverride={parseAs(armour)} />);
    const dialog = await screen.findByRole('dialog', { name: "What's new" });
    expect(within(dialog).getAllByRole('listitem').length).toBeGreaterThan(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('shows no update button without a newer version, and starts the update on click', async () => {
    const none = fakeApi();
    const { unmount } = render(<App api={none.api} parseOverride={parseAs(armour)} />);
    await screen.findByRole('button', { name: 'Settings' });
    await act(async () => undefined);
    expect(screen.queryByRole('button', { name: /Update to/ })).toBeNull();
    unmount();
    const available = fakeApi({ update: { state: 'available', version: '0.3.7', manual: false } });
    render(<App api={available.api} parseOverride={parseAs(armour)} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Update to 0.3.7' }));
    expect(available.api.startUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('item defaults (spec 014, SoT 0.2.11)', () => {
  it('preselects the unrestricted Bone and keeps it cleared once the user deselects it', async () => {
    await mount(armour);
    const plain = await screen.findByRole('radio', { name: 'TEST_ONLY_BONE_ARMOUR_PLAIN_NAME' });
    await waitFor(() => expect(plain.getAttribute('aria-checked')).toBe('true'));
    fireEvent.click(plain);
    await act(async () => undefined);
    expect(plain.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Choose a currency to see the modifiers you can get.')).toBeTruthy();
  });
});

describe('keyboard focus stays in the game (spec 015, SoT 0.2.12)', () => {
  it('asks for focus only for text fields and gives it back after typing', async () => {
    const { api } = await mount(armour);
    fireEvent.mouseDown(screen.getByRole('radio', { name: 'TEST_ONLY_BONE_ARMOUR_PLAIN_NAME' }));
    expect(api.requestKeyboardFocus).not.toHaveBeenCalled();
    const search = await screen.findByRole('searchbox');
    fireEvent.mouseDown(search);
    expect(api.requestKeyboardFocus).toHaveBeenCalledTimes(1);
    fireEvent.blur(search);
    expect(api.releaseKeyboardFocus).toHaveBeenCalledTimes(1);
  });
});

describe('copy loading state (spec 016)', () => {
  it('dims the overlay with a spinner while the hotkey copies, and clears it afterwards', async () => {
    const f = await mount(armour);
    act(() => f.pushBusy(true));
    expect(screen.getByRole('status', { name: 'Copying the item…' })).toBeTruthy();
    act(() => f.pushBusy(false));
    expect(screen.queryByRole('status', { name: 'Copying the item…' })).toBeNull();
  });
});
