// Pre-package scan (spec 008): the bundled code and data pack must contain no TEST_ONLY data.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PACK_FILE } from './lib/paths';

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });

const hits = [PACK_FILE, ...files('out')].filter((f) => /TEST_ONLY/.test(readFileSync(f, 'utf8')));
if (hits.length > 0) {
  console.error(`TEST_ONLY data found in release inputs:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log('artifact scan: no TEST_ONLY data');
