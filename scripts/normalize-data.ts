// Builds and validates the production data pack from the latest snapshot (SoT §6.7).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { buildPack, sha256, type SnapshotInputs } from '../src/data/adapters/build-pack';
import { loadRuleRegistry } from '../src/data/adapters/rules';
import { validatePack } from '../src/data/adapters/validate-pack';
import { latestSnapshotDir, MANIFEST_FILE, PACK_FILE, REPORTS_DIR, RULES_DIR, TARGET_FILE } from './lib/paths';

const snapshotDir = latestSnapshotDir();
const read = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const inputs: SnapshotInputs = {
  record: read(join(snapshotDir, 'snapshot.json')),
  mods: read(join(snapshotDir, 'mods.min.json')),
  bases: read(join(snapshotDir, 'base_items.min.json')),
  itemClasses: read(join(snapshotDir, 'item_classes.min.json')),
  uniques: read(join(snapshotDir, 'uniques.min.json')),
  statDescriptions: read(join(snapshotDir, 'stat_translations', 'stat_descriptions.min.json')),
};

const rulesDigest = sha256(
  readdirSync(RULES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => `${f}\n${readFileSync(join(RULES_DIR, f), 'utf8')}`)
    .join('\n'),
);
const target = read<{ targetGameVersion: string; stale: boolean }>(TARGET_FILE);
const { pack, report } = buildPack(inputs, loadRuleRegistry(RULES_DIR), target, rulesDigest);
const issues = validatePack(pack, report.issues);
pack.manifest.validated = issues.length === 0;

const reportDir = join(REPORTS_DIR, basename(snapshotDir));
mkdirSync(reportDir, { recursive: true });
writeFileSync(join(reportDir, 'validation-report.json'), `${JSON.stringify({ validated: pack.manifest.validated, issues }, null, 2)}\n`);
writeFileSync(
  join(reportDir, 'audit-report.json'),
  `${JSON.stringify(
    {
      lichAudit: report.lichAudit,
      resolvedEntities: report.resolvedEntities,
      resolvedOverrides: report.resolvedOverrides,
      droppedModsByDomain: report.droppedModsByDomain,
      statsWithoutTranslation: report.statsWithoutTranslation,
      excludedUnreachableDesecrated: report.excludedUnreachableDesecrated,
      abyssMarkModifierIds: pack.abyssMarkModifierIds,
    },
    null,
    2,
  )}\n`,
);

for (const file of [PACK_FILE, MANIFEST_FILE]) mkdirSync(dirname(file), { recursive: true });
writeFileSync(PACK_FILE, `${JSON.stringify(pack)}\n`);
writeFileSync(MANIFEST_FILE, `${JSON.stringify(pack.manifest, null, 2)}\n`);

console.log(`snapshot ${snapshotDir}`);
console.log(`bases ${pack.baseItems.length}, modifiers ${pack.modifiers.length}, bones ${pack.bones.length}, omens ${pack.omens.length}`);
console.log(`lich audit rows ${report.lichAudit.length}, stats without translation ${report.statsWithoutTranslation.length}, excluded unreachable desecrated ${report.excludedUnreachableDesecrated.length}`);
console.log(`dataPackId ${pack.manifest.dataPackId}`);
if (issues.length > 0) {
  console.error(`VALIDATION FAILED (${issues.length} issues), see ${reportDir}/validation-report.json`);
  for (const i of issues.slice(0, 20)) console.error(`  ${i.code}: ${i.detail}`);
  process.exit(1);
}
console.log('validated: true');
