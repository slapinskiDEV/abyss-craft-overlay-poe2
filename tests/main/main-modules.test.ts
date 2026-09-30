import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeDataPackId } from '../../src/data/adapters/build-pack';
import { isValidAccelerator } from '../../src/main/accelerator';
import { decideHotkeyAction } from '../../src/main/hotkey-action';
import { COPY_WAIT_MS, copyThenRead, copyThenReadDetailed } from '../../src/main/copy-flow';
import { copyShortcutSequence } from '../../src/main/copy-shortcut';
import { CHANGELOG_ENTRIES, LATEST_CHANGELOG_ENTRY, pendingChangelog } from '../../src/shared/changelog';
import { loadDataPackFile } from '../../src/main/data-pack-loader';
import { validDebugReport } from '../../src/main/ipc-validation';
import { DEFAULT_HOTKEY, defaultSettings, mergeSettings, sanitizeSettings } from '../../src/main/settings-model';
import { SettingsStore } from '../../src/main/settings';
import { initLog, log, LOG_MAX_BYTES } from '../../src/main/log';
import { restoreBounds } from '../../src/main/window-bounds';
import { testPack } from '../fixtures/data/test-only-pack';

describe('hotkey action (SoT §16.1, spec 009)', () => {
  it('shows when hidden, refreshes on a new copy, hides otherwise', () => {
    expect(decideHotkeyAction(false, 'TEST_ONLY a', 'TEST_ONLY a')).toBe('show');
    expect(decideHotkeyAction(true, 'TEST_ONLY a', 'TEST_ONLY b')).toBe('refresh');
    expect(decideHotkeyAction(true, undefined, 'TEST_ONLY a')).toBe('refresh');
    expect(decideHotkeyAction(true, 'TEST_ONLY a', 'TEST_ONLY a')).toBe('hide');
  });
});

describe('auto-copy (SoT §3.1 0.2.6, spec 010)', () => {
  it('sends Ctrl+Alt+C once, releasing the held Shift first and every key it pressed', () => {
    const seq = copyShortcutSequence();
    expect(seq[0]).toEqual({ vk: 0x10, up: true });
    expect(seq.filter((e) => e.vk === 0x43)).toEqual([{ vk: 0x43, up: false }, { vk: 0x43, up: true }]);
    const pressed = seq.filter((e) => !e.up).map((e) => e.vk);
    for (const vk of pressed) expect(seq.findLastIndex((e) => e.vk === vk && e.up)).toBeGreaterThan(seq.findIndex((e) => e.vk === vk && !e.up));
  });

  const clipboardAfter = (texts: string[], sendCopy = () => true) => {
    let i = 0;
    let clock = 0;
    const sent = { count: 0 };
    const flow = copyThenRead({
      read: async () => ({ text: texts[Math.min(i++, texts.length - 1)] ?? '', readAt: '' }),
      sendCopy: async () => (sent.count++, sendCopy()),
      sleep: async (ms) => void (clock += ms),
      now: () => clock,
    });
    return { flow, sent };
  };

  it('returns the newly copied item as soon as the clipboard changes', async () => {
    const { flow, sent } = clipboardAfter(['TEST_ONLY old', 'TEST_ONLY old', 'TEST_ONLY new']);
    expect((await flow).text).toBe('TEST_ONLY new');
    expect(sent.count).toBe(1);
  });

  it('returns the unchanged clipboard after a bounded wait (nothing hovered / same item)', async () => {
    const { flow } = clipboardAfter(['TEST_ONLY old']);
    expect((await flow).text).toBe('TEST_ONLY old');
  });

  // Windows path (spec 018): wait on the clipboard sequence number, read the text only after it changed.
  const withSequence = (changeAfterPolls: number | null, texts: string[]) => {
    let clock = 0;
    let polls = 0;
    let reads = 0;
    const flow = copyThenReadDetailed({
      read: async () => ({ text: texts[Math.min(reads++, texts.length - 1)] ?? '', readAt: '' }),
      sendCopy: async () => true,
      sleep: async (ms) => void (clock += ms),
      now: () => clock,
      sequence: () => (changeAfterPolls !== null && polls++ >= changeAfterPolls ? 2 : 1),
    });
    return { flow, reads: () => reads };
  };

  it('reads the clipboard text only once the sequence number changed', async () => {
    const { flow, reads } = withSequence(3, ['TEST_ONLY new']);
    const r = await flow;
    expect(r).toMatchObject({ changed: true, snapshot: { text: 'TEST_ONLY new' } });
    expect(reads()).toBe(1);
  });

  it('re-reads while the game has emptied the clipboard but not written the item yet', async () => {
    const r = await withSequence(1, ['', '', 'TEST_ONLY new']).flow;
    expect(r.snapshot.text).toBe('TEST_ONLY new');
  });

  it('gives up after the wall-clock bound when the sequence never changes', async () => {
    const { flow, reads } = withSequence(null, ['TEST_ONLY old']);
    const r = await flow;
    expect(r.changed).toBe(false);
    expect(r.waitMs).toBeGreaterThanOrEqual(COPY_WAIT_MS);
    expect(reads()).toBe(1); // one final read, no polling of the text
  });

  it('falls back to a plain read where sending is unsupported', async () => {
    const { flow } = clipboardAfter(['TEST_ONLY old', 'TEST_ONLY new'], () => false);
    expect((await flow).text).toBe('TEST_ONLY old');
  });
});

describe('settings (spec 001)', () => {
  it('defaults follow SoT §5.6 / §16', () => {
    expect(defaultSettings('pl-PL')).toMatchObject({ localization: { uiLocale: 'pl', gameLocale: 'en', clipboardLocale: 'auto' }, hotkey: DEFAULT_HOTKEY, closeOnBlur: false, showLegacyCurrencies: false });
    expect(defaultSettings('de-DE').localization.uiLocale).toBe('en');
    expect(DEFAULT_HOTKEY).toBe('Alt+T');
  });

  it('replaces invalid or unregistered values with defaults', () => {
    const d = defaultSettings('en-US');
    const s = sanitizeSettings({ localization: { uiLocale: 'TEST_ONLY_xx', gameLocale: 'de', clipboardLocale: 'de' }, hotkey: 'D', closeOnBlur: 'yes', window: { width: -5 } }, d);
    expect(s.localization).toEqual(d.localization);
    expect(s.hotkey).toBe(DEFAULT_HOTKEY);
    expect(s.closeOnBlur).toBe(false);
    expect(s.window.width).toBe(d.window.width);
    expect(sanitizeSettings('garbage', d)).toEqual(d);
  });

  it('merges nested patches', () => {
    const d = defaultSettings('en-US');
    const s = mergeSettings(d, { localization: { uiLocale: 'pl' }, window: { x: 10, y: 20 } }, d);
    expect(s.localization).toEqual({ uiLocale: 'pl', gameLocale: 'en', clipboardLocale: 'auto' });
    expect(s.window).toMatchObject({ x: 10, y: 20, width: d.window.width });
  });
});

describe('settings file errors never escape (spec 017 A2, A3)', () => {
  const quiet = <T>(fn: () => T): T => {
    const warn = console.warn;
    console.warn = () => {};
    try {
      return fn();
    } finally {
      console.warn = warn;
    }
  };

  it('keeps an update in memory when the file cannot be written', () => {
    const dir = mkdtempSync(join(tmpdir(), 'settings-'));
    mkdirSync(join(dir, 'settings.json.tmp')); // writeFileSync on a directory fails
    const store = new SettingsStore(dir, 'en-US');
    const next = quiet(() => store.update({ closeOnBlur: true }));
    expect(next.closeOnBlur).toBe(true);
    expect(store.get().closeOnBlur).toBe(true);
  });

  it('starts with defaults when the file cannot be read or backed up', () => {
    const dir = mkdtempSync(join(tmpdir(), 'settings-'));
    mkdirSync(join(dir, 'settings.json')); // unreadable as a file, and cannot be copied
    const store = quiet(() => new SettingsStore(dir, 'pl-PL'));
    expect(store.get()).toEqual(defaultSettings('pl-PL'));
  });

  it('backs up a corrupt file and writes valid settings on the next change', () => {
    const dir = mkdtempSync(join(tmpdir(), 'settings-'));
    writeFileSync(join(dir, 'settings.json'), '{ not json');
    const store = new SettingsStore(dir, 'en-US');
    store.update({ closeOnBlur: true });
    expect(readFileSync(join(dir, 'settings.json.bak'), 'utf8')).toBe('{ not json');
    expect(JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8')).closeOnBlur).toBe(true);
  });
});

describe('diagnostic log (spec 018)', () => {
  it('appends events, rotates a large file and never throws', () => {
    const dir = initLog(join(mkdtempSync(join(tmpdir(), 'log-')), 'logs'));
    log('hotkey', { visible: true });
    expect(readFileSync(join(dir, 'overlay.log'), 'utf8')).toMatch(/ hotkey \{"visible":true\}\n$/);
    writeFileSync(join(dir, 'overlay.log'), 'x'.repeat(LOG_MAX_BYTES + 1));
    log('after-rotate');
    expect(readFileSync(join(dir, 'overlay.log'), 'utf8')).toMatch(/after-rotate/);
    expect(readFileSync(join(dir, 'overlay.log.1'), 'utf8').length).toBe(LOG_MAX_BYTES + 1);
    mkdirSync(join(dir, 'blocked'));
    initLog(join(dir, 'blocked'));
    mkdirSync(join(dir, 'blocked', 'overlay.log')); // appending to a directory fails
    expect(() => log('ignored')).not.toThrow();
  });
});

describe('accelerators', () => {
  it.each([
    ['CommandOrControl+Shift+D', true],
    ['Alt+F9', true],
    ['D', false],
    ['Shift+Shift+D', false],
    ['Ctrl+', false],
    ['Ctrl+Shift', false],
  ])('%s -> %s', (a, ok) => expect(isValidAccelerator(a)).toBe(ok));
});

describe('window bounds (multi-monitor safety)', () => {
  const primary = { x: 0, y: 0, width: 1920, height: 1040 };
  it('keeps bounds visible on some display', () => {
    expect(restoreBounds({ x: 2000, y: 100, width: 560, height: 720 }, [primary, { x: 1920, y: 0, width: 1920, height: 1040 }], primary)).toEqual({ x: 2000, y: 100, width: 560, height: 720 });
  });
  it('resets off-screen bounds to the primary display', () => {
    const r = restoreBounds({ x: 5000, y: 5000, width: 560, height: 720 }, [primary], primary);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(1920);
  });
});

describe('data pack loading (spec 001, 008)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'poe2-pack-'));
  const write = (name: string, value: unknown) => {
    const file = join(dir, name);
    writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
    return file;
  };
  const good = () => {
    const { manifest, ...content } = testPack();
    return { ...content, manifest: { ...manifest, dataPackId: computeDataPackId(content), validated: true } };
  };

  it('loads a valid pack', () => expect(loadDataPackFile(write('ok.json', good())).ok).toBe(true));
  it('reports a missing pack', () => expect(loadDataPackFile(join(dir, 'none.json'))).toEqual({ ok: false, code: 'DATA_PACK_MISSING' }));
  it('rejects a tampered pack', () => {
    const pack = good();
    pack.abyssMarkModifierIds = ['tampered'];
    expect(loadDataPackFile(write('bad.json', pack))).toEqual({ ok: false, code: 'DATA_PACK_INTEGRITY_FAILED' });
  });
  it('rejects an unvalidated pack', () => {
    const pack = good();
    pack.manifest.validated = false;
    expect(loadDataPackFile(write('unvalidated.json', pack))).toEqual({ ok: false, code: 'DATA_PACK_NOT_VALIDATED' });
  });
  it('rejects unreadable and unsupported packs', () => {
    expect(loadDataPackFile(write('broken.json', '{'))).toEqual({ ok: false, code: 'DATA_PACK_INTEGRITY_FAILED' });
    const pack = good();
    pack.manifest.schemaVersion = 99;
    expect(loadDataPackFile(write('schema.json', pack))).toEqual({ ok: false, code: 'DATA_PACK_SCHEMA_UNSUPPORTED' });
  });
});

describe('IPC payload validation', () => {
  it('limits the debug report size', () => {
    expect(validDebugReport('{}')).toBe(true);
    expect(validDebugReport('x'.repeat(300 * 1024))).toBe(false);
    expect(validDebugReport(42)).toBe(false);
  });
});

describe('data pack path (spec 008)', () => {
  it('uses app resources when packaged and the repo in development', async () => {
    const { dataPackPath } = await import('../../src/main/resource-paths');
    expect(dataPackPath({ isPackaged: true, resourcesPath: '/r', appPath: '/a' })).toBe(join('/r', 'data-pack', 'pack.json'));
    expect(dataPackPath({ isPackaged: false, resourcesPath: '/r', appPath: '/a' })).toBe(join('/a', 'src', 'data', 'normalized', 'pack', 'pack.json'));
  });
});

describe('release notes (spec 011)', () => {
  it('shows unseen entries newest first, nothing once read, the latest for pre-changelog settings', () => {
    expect(pendingChangelog(LATEST_CHANGELOG_ENTRY)).toEqual([]);
    expect(pendingChangelog(null)).toEqual([LATEST_CHANGELOG_ENTRY]);
    expect(pendingChangelog('TEST_ONLY_unknown')).toEqual([LATEST_CHANGELOG_ENTRY]);
    if (CHANGELOG_ENTRIES.length > 1) expect(pendingChangelog(CHANGELOG_ENTRIES[0])).toEqual(CHANGELOG_ENTRIES.slice(1).reverse());
  });

  it('settings default to checking for updates and drop unknown changelog IDs', () => {
    const d = defaultSettings('en-US');
    expect(d.checkForUpdates).toBe(true);
    expect(sanitizeSettings({ changelogSeen: 'TEST_ONLY_x' }, d).changelogSeen).toBeNull();
    expect(sanitizeSettings({ changelogSeen: LATEST_CHANGELOG_ENTRY }, d).changelogSeen).toBe(LATEST_CHANGELOG_ENTRY);
  });
});

describe('settings schema 2 (three-column layout, SoT 0.2.9)', () => {
  it('replaces the narrow window of schema 1 settings once and keeps schema 2 bounds', () => {
    const d = defaultSettings('en-US');
    expect(sanitizeSettings({ settingsSchemaVersion: 1, window: { x: 10, y: 10, width: 560, height: 720 } }, d).window).toEqual(d.window);
    expect(sanitizeSettings({ settingsSchemaVersion: 2, window: { width: 700, height: 500 } }, d).window).toEqual({ width: 700, height: 500 });
  });
});

describe('settings schema 3 (default hotkey Alt+T, SoT 0.2.12)', () => {
  it('moves an unchanged old default hotkey to Alt+T once and keeps custom hotkeys', () => {
    const d = defaultSettings('en-US');
    expect(sanitizeSettings({ settingsSchemaVersion: 2, hotkey: 'CommandOrControl+Shift+D' }, d).hotkey).toBe('Alt+T');
    expect(sanitizeSettings({ settingsSchemaVersion: 2, hotkey: 'Alt+F2' }, d).hotkey).toBe('Alt+F2');
    // Schema 3 missed other spellings; schema 4 moves them once (maintainer report).
    expect(sanitizeSettings({ settingsSchemaVersion: 3, hotkey: 'Control+Shift+D' }, d).hotkey).toBe('Alt+T');
    expect(sanitizeSettings({ settingsSchemaVersion: 3, hotkey: 'Shift+Ctrl+D' }, d).hotkey).toBe('Alt+T');
    expect(sanitizeSettings({ settingsSchemaVersion: 3, hotkey: 'Control+Shift+F' }, d).hotkey).toBe('Control+Shift+F');
    expect(sanitizeSettings({ settingsSchemaVersion: 4, hotkey: 'Control+Shift+D' }, d).hotkey).toBe('Control+Shift+D');
    expect(sanitizeSettings({ settingsSchemaVersion: 2, window: { width: 700, height: 500 } }, d).window).toEqual({ width: 700, height: 500 });
  });
});
