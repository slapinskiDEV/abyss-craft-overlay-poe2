// Spec 007 traceability: every SoT §18.3 case has a named test and every mapped file exists.
import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const CASES = [...Array.from({ length: 20 }, (_, i) => i + 1), 24, 25];
const FILES = [
  'tests/domain/sot-18-3.test.ts',
  'tests/domain/sot-18-3.real.test.ts',
  'tests/i18n/locales.test.ts',
  'tests/i18n/translations.test.ts',
  'tests/renderer/app.test.tsx',
  'tests/renderer/view-model.test.ts',
  'tests/data/validate-pack.test.ts',
  'tests/architecture/no-tests-import.test.ts',
  'tests/architecture/renderer-catalog-guard.test.ts',
  'tests/architecture/release-gate.test.ts',
  'tests/architecture/runtime-boundary.test.ts',
  'tests/architecture/domain-boundary.test.ts',
  'tests/integration/pipeline.test.ts',
  'tests/architecture/definition-of-done.md',
  'tests/manual/well-of-souls/TEMPLATE.md',
  'tests/manual/overlay/CHECKLIST.md',
];

it('names a test for every SoT §18.3 engine case', () => {
  const text = readFileSync('tests/domain/sot-18-3.test.ts', 'utf8');
  expect(CASES.filter((n) => !text.includes(`SoT 18.3 #${n} `))).toEqual([]);
});

it('has every file of the traceability matrix', () => {
  expect(FILES.filter((f) => !existsSync(f))).toEqual([]);
});
