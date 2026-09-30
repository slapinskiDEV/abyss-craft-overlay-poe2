// SoT §3.1 runtime boundary: clipboard -> overlay only. Static checks over src/ and package.json.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FORBIDDEN_MODULES = [/^(node:)?child_process$/, /^robotjs/, /^@nut-tree/, /^node-key-sender/, /^ffi-napi/, /^koffi/, /^node-window-manager/, /^active-win/, /^ps-list/, /^iohook/, /^uiohook-napi/];
// SoT §3.1 (0.2.6), spec 010: the single allowed input to the game is the copy shortcut, sent via koffi
// from this one module only.
const COPY_SHORTCUT_MODULE = join('src', 'main', 'copy-shortcut.ts');
const COPY_SHORTCUT_EXCEPTION = /^koffi$/;
const NETWORK_MODULES = [/^(node:)?(net|http|https|http2|dgram|tls)$/, /^axios/, /^node-fetch/, /^got$/, /^electron-updater$/];
// SoT §3.5 (0.2.8), spec 011: the app update check is the only network access, from one module.
const APP_UPDATE_MODULE = join('src', 'main', 'app-update.ts');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}
const sources = files('src').map((path) => ({ path, text: readFileSync(path, 'utf8') }));
const importsOf = (text: string) =>
  [...text.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? '');

describe('runtime boundary (SoT §3.1, spec 001)', () => {
  it('imports no input-injection, process or window-inspection modules', () => {
    const allowed = (path: string, s: string) => path === COPY_SHORTCUT_MODULE && COPY_SHORTCUT_EXCEPTION.test(s);
    const hits = sources.flatMap(({ path, text }) => importsOf(text).filter((s) => FORBIDDEN_MODULES.some((re) => re.test(s)) && !allowed(path, s)).map((s) => `${path}: ${s}`));
    expect(hits).toEqual([]);
  });

  it('sends only the copy shortcut, from one module (SoT §3.1, spec 010)', () => {
    const senders = sources.filter(({ text }) => /keybd_event|SendInput|mouse_event/.test(text)).map(({ path }) => path);
    expect(senders).toEqual([COPY_SHORTCUT_MODULE]);
    const text = sources.find(({ path }) => path === COPY_SHORTCUT_MODULE)?.text ?? '';
    expect(text).not.toMatch(/SendInput|mouse_event/);
    // Only Shift, Ctrl, Alt and C are ever sent.
    expect([...text.matchAll(/const VK_\w+ = (0x[0-9A-F]+)/g)].map((m) => m[1])).toEqual(['0x10', '0x11', '0x12', '0x43']);
  });

  it('has no network access at runtime except the app update check (SoT §6.1, §3.5)', () => {
    const hits = sources.flatMap(({ path, text }) => [
      ...importsOf(text).filter((s) => NETWORK_MODULES.some((re) => re.test(s)) && !(path === APP_UPDATE_MODULE && s === 'electron-updater')).map((s) => `${path}: ${s}`),
      ...(/\bfetch\s*\(|XMLHttpRequest|WebSocket\(/.test(text) ? [`${path}: network API`] : []),
    ]);
    expect(hits).toEqual([]);
  });

  it('touches the clipboard only in src/main/clipboard.ts, without polling', () => {
    const users = sources.filter(({ text }) => /\bclipboard\.(read|write)\w*\(/.test(text)).map(({ path }) => path);
    expect(users).toEqual([join('src', 'main', 'clipboard.ts')]);
    const clipboardModule = sources.find(({ path }) => path === join('src', 'main', 'clipboard.ts'))?.text ?? '';
    expect(clipboardModule).not.toMatch(/setInterval|setTimeout/);
    expect((clipboardModule.match(/clipboard\.write\w*\(/g) ?? []).length).toBe(1);
  });

  it('declares no forbidden dependency', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as Record<string, Record<string, string> | undefined>;
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies });
    expect(deps.filter((d) => FORBIDDEN_MODULES.some((re) => re.test(d)) && !COPY_SHORTCUT_EXCEPTION.test(d))).toEqual([]);
  });

  it('detects a forbidden import (self-test)', () => {
    expect(importsOf("import { exec } from 'node:child_process';").some((s) => FORBIDDEN_MODULES.some((re) => re.test(s)))).toBe(true);
  });
});

describe('app update boundary (SoT §3.5, spec 011)', () => {
  const text = readFileSync(join('src', 'main', 'app-update.ts'), 'utf8');
  it('checks only the public releases repository and never downloads on its own', () => {
    expect([...text.matchAll(/https:\/\/[^\s`'"]+/g)].map((m) => m[0])).toEqual(['https://github.com/${RELEASES_REPO}/releases/latest/download', 'https://github.com/${RELEASES_REPO}/releases/latest']);
    expect(text).toMatch(/autoDownload = false/);
    expect(text).toMatch(/autoInstallOnAppQuit = false/);
  });
});
