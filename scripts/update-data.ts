// npm run data:update — SoT §6.7 workflow: fetch -> hash/archive -> evidence -> discovery ->
// normalize + provenance + gates + manifest -> domain fixtures -> semantic diff.
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { latestSnapshotDir, PACK_FILE, REPORTS_DIR } from './lib/paths';

const run = (cmd: string) => execSync(cmd, { stdio: 'inherit' });
const previousPack = join(mkdtempSync(join(tmpdir(), 'poe2-pack-')), 'previous-pack.json');
const hadPrevious = existsSync(PACK_FILE);
if (hadPrevious) copyFileSync(PACK_FILE, previousPack);

run('tsx scripts/update-repoe.ts');
run('tsx scripts/fetch-wiki-evidence.ts');
run(`tsx scripts/inspect-snapshot.ts ${latestSnapshotDir()}`);
run('tsx scripts/normalize-data.ts');
run('vitest run');
const diffOut = join(REPORTS_DIR, basename(latestSnapshotDir()), 'semantic-diff.md');
run(`tsx scripts/semantic-diff.ts ${hadPrevious ? previousPack : '/nonexistent'} ${PACK_FILE} ${diffOut}`);
console.log(`Review ${diffOut} and the audit report, then commit the snapshot, rules and pack.`);
