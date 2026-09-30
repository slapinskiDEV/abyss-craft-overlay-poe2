// Real-data test gate (spec 007): skips when the snapshot is absent in ordinary dev/CI, but
// fails instead of skipping when REQUIRE_REAL_DATA=1 (release gate, SoT §18.3 #28, §19.4).
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';

const SNAPSHOTS_DIR = join('data-source', 'snapshots');

export function latestSnapshotDir(): string | null {
  if (!existsSync(SNAPSHOTS_DIR)) return null;
  const dirs = readdirSync(SNAPSHOTS_DIR).filter((d) => existsSync(join(SNAPSHOTS_DIR, d, 'snapshot.json'))).sort();
  const latest = dirs.at(-1);
  return latest ? join(SNAPSHOTS_DIR, latest) : null;
}

export function describeRealData(name: string, body: (snapshotDir: string) => void): void {
  const dir = latestSnapshotDir();
  if (dir) {
    describe(name, () => body(dir));
  } else if (process.env.REQUIRE_REAL_DATA === '1') {
    describe(name, () => {
      it('requires the real RePoE snapshot', () => {
        throw new Error(`REQUIRE_REAL_DATA=1 but no snapshot found under ${SNAPSHOTS_DIR}`);
      });
    });
  } else {
    describe.skip(`${name} (no RePoE snapshot)`, () => undefined);
  }
}
