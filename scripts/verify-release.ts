// npm run verify:release — non-skippable real-data release gate (SoT §18.3 #28, §19.4).
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateTestReport, type VitestJsonReport } from './lib/release-gate';

const run = (cmd: string, env: NodeJS.ProcessEnv = {}) => execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } });

run('tsx scripts/validate-data.ts');
run('tsx scripts/validate-translations.ts', { REQUIRE_REAL_DATA: '1' });
const out = join(mkdtempSync(join(tmpdir(), 'poe2-gate-')), 'report.json');
try {
  run(`vitest run --reporter=default --reporter=json --outputFile=${out}`, { REQUIRE_REAL_DATA: '1' });
} catch {
  // failures are reported below from the JSON report
}
const verdict = evaluateTestReport(JSON.parse(readFileSync(out, 'utf8')) as VitestJsonReport);
for (const line of verdict.problems) console.error(line);
if (!verdict.ok) process.exit(1);
console.log(`release gate passed: ${verdict.passed} tests, 0 skipped`);
