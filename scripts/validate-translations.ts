// npm run i18n:validate — translation parity, code coverage, wording and entity-literal checks.
import { existsSync, readFileSync } from 'node:fs';
import type { DataPack } from '../src/data/normalized/types';
import { checkEntityLiterals, checkTranslations } from '../src/i18n/validate-translations';
import { UI_LOCALES } from '../src/i18n/ui/registry';
import { PACK_FILE } from './lib/paths';

const allowlist = JSON.parse(readFileSync('src/i18n/ui/parity-allowlist.json', 'utf8')) as string[];
const issues = checkTranslations(UI_LOCALES, allowlist);
if (existsSync(PACK_FILE)) {
  const pack = JSON.parse(readFileSync(PACK_FILE, 'utf8')) as DataPack;
  issues.push(...checkEntityLiterals(UI_LOCALES, entityNames(pack)));
} else if (process.env.REQUIRE_REAL_DATA === '1') {
  issues.push({ code: 'PACK_MISSING', locale: '-', key: PACK_FILE });
}
for (const i of issues) console.error(`${i.code} [${i.locale}] ${i.key}${i.detail ? ` — ${i.detail}` : ''}`);
if (issues.length > 0) process.exit(1);
console.log(`translations OK (${UI_LOCALES.map((l) => l.id).join(', ')})`);

function entityNames(pack: DataPack): string[] {
  return [...pack.bones, ...pack.omens, ...pack.otherCurrencies, ...pack.baseItems, ...pack.itemClasses].map((e) => e.canonicalNameEn);
}
