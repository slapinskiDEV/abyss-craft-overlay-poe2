// SoT §0.2 rule 9: synthetic test data must be unreachable from production code.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });

it('src/ never imports from tests/', () => {
  const hits = files('src').filter((f) => /from\s+['"][^'"]*\/tests\//.test(readFileSync(f, 'utf8')));
  expect(hits).toEqual([]);
});
