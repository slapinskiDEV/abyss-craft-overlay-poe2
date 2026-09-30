// Re-validates the committed production pack (used by the release gate, spec 007/008).
import { readFileSync } from 'node:fs';
import type { DataPack } from '../src/data/normalized/types';
import { validatePack } from '../src/data/adapters/validate-pack';
import { MANIFEST_FILE, PACK_FILE } from './lib/paths';

const pack = JSON.parse(readFileSync(PACK_FILE, 'utf8')) as DataPack;
const manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')) as DataPack['manifest'];
const issues = validatePack(pack);
if (JSON.stringify(manifest) !== JSON.stringify(pack.manifest)) issues.push({ code: 'MANIFEST_MISMATCH', detail: MANIFEST_FILE });
if (!pack.manifest.validated) issues.push({ code: 'DATA_PACK_NOT_VALIDATED', detail: PACK_FILE });
if (issues.length > 0) {
  for (const i of issues) console.error(`${i.code}: ${i.detail}`);
  process.exit(1);
}
console.log(`pack ${pack.manifest.dataPackId} valid`);
