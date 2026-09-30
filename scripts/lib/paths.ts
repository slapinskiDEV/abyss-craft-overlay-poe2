import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const SNAPSHOTS_DIR = join('data-source', 'snapshots');
export const RULES_DIR = join('data-source', 'rules');
export const TARGET_FILE = join('data-source', 'manifest', 'target.json');
export const REPORTS_DIR = join('data-source', 'reports');
export const PACK_FILE = join('src', 'data', 'normalized', 'pack', 'pack.json');
export const MANIFEST_FILE = join('src', 'data', 'manifest', 'manifest.json');

export function latestSnapshotDir(): string {
  const dirs = existsSync(SNAPSHOTS_DIR)
    ? readdirSync(SNAPSHOTS_DIR).filter((d) => existsSync(join(SNAPSHOTS_DIR, d, 'snapshot.json'))).sort()
    : [];
  const latest = dirs.at(-1);
  if (!latest) throw new Error(`No snapshot under ${SNAPSHOTS_DIR}; run npm run data:fetch`);
  return join(SNAPSHOTS_DIR, latest);
}
