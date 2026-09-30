// SoT §4.2: domain/ must have no Electron, React or i18next dependency.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// SoT §4.2, spec 003: no UI/i18n dependencies and no locale registries in domain or parser code.
const FORBIDDEN = [/^electron($|\/)/, /^react($|-dom|\/)/, /^i18next($|\/)/, /^react-i18next($|\/)/, /(^|\/)i18n(\/|$)/];
const PURE_DIRS = ['src/domain', 'src/parser'];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

function importsOf(source: string): string[] {
  const re = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
  return [...source.matchAll(re)].map((m) => m[1] ?? m[2] ?? m[3] ?? '');
}

describe('domain/parser purity', () => {
  it('forbids importing the i18n layer', () => {
    expect(FORBIDDEN.some((re) => re.test('../../i18n/ui/registry'))).toBe(true);
  });

  for (const dir of PURE_DIRS) {
    it(`${dir} imports no Electron/React/i18next`, () => {
      const violations = sourceFiles(dir).flatMap((file) =>
        importsOf(readFileSync(file, 'utf8'))
          .filter((spec) => FORBIDDEN.some((re) => re.test(spec)))
          .map((spec) => `${file}: ${spec}`),
      );
      expect(violations).toEqual([]);
    });
  }

  it('detects a forbidden import', () => {
    expect(importsOf(`import { app } from 'electron';`)).toEqual(['electron']);
    expect(FORBIDDEN.some((re) => re.test('react-i18next'))).toBe(true);
  });
});
