// Records PoE2 Wiki evidence for the rule registry (SoT §0.3, §6.3). Stores only provenance and
// short quoted excerpts (revision-pinned), not page copies. Networked dev script, like data:fetch.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const API = 'https://www.poe2wiki.net/api.php';

// Pages cited in SoT §25. Every regex must match (capture group 1) or the script fails, so a wiki
// edit that removes the evidence is detected instead of silently kept.
const DESCRIPTION = /\|description\s*=\s*([^\n]*)/;
const GNAWED = [DESCRIPTION, /(This item can only be used on items of item level \d+ or below\.)/];
const ANCIENT = [DESCRIPTION, /(\|crafting_mod_level_min\s*=\s*\d+)/, /('''Minimum Modifier Level''':[^\n]*)/];
const LICH = [
  DESCRIPTION,
  /(Despite the tooltip specifying weapons and jewellery[^\n]*)/,
  /(Note that the omen will be consumed even if no[^\n]*)/,
];

const PAGES: ReadonlyArray<{ page: string; quotes: RegExp[] }> = [
  { page: 'Gnawed_Jawbone', quotes: GNAWED },
  { page: 'Preserved_Jawbone', quotes: [DESCRIPTION] },
  { page: 'Ancient_Jawbone', quotes: ANCIENT },
  { page: 'Gnawed_Rib', quotes: GNAWED },
  { page: 'Preserved_Rib', quotes: [DESCRIPTION] },
  { page: 'Ancient_Rib', quotes: ANCIENT },
  { page: 'Gnawed_Collarbone', quotes: GNAWED },
  { page: 'Preserved_Collarbone', quotes: [DESCRIPTION] },
  { page: 'Ancient_Collarbone', quotes: ANCIENT },
  { page: 'Preserved_Cranium', quotes: [DESCRIPTION] },
  { page: 'Altered_Collarbone', quotes: [DESCRIPTION] },
  {
    page: 'Preserved_Vertebrae',
    quotes: [DESCRIPTION, /(\|drop_enabled\s*=\s*False)/, /(\* Preserved Vertebrae no longer drop\.)/],
  },
  { page: 'Omen_of_Sinistral_Necromancy', quotes: [DESCRIPTION] },
  { page: 'Omen_of_Dextral_Necromancy', quotes: [DESCRIPTION] },
  { page: 'Omen_of_the_Liege', quotes: LICH },
  { page: 'Omen_of_the_Sovereign', quotes: LICH },
  { page: 'Omen_of_the_Blackblooded', quotes: LICH },
  {
    page: 'Omen_of_Putrefaction',
    quotes: [DESCRIPTION, /(This omen will always attempt to roll the maximum number[^\n]*)/, /(When used with an Ancient tier[^\n]*)/],
  },
  { page: 'Omen_of_Abyssal_Echoes', quotes: [DESCRIPTION] },
  { page: 'Omen_of_Light', quotes: [DESCRIPTION] },
  { page: 'Essence_of_the_Abyss', quotes: [DESCRIPTION, /(When using a \[\[preserved bone\]\][^\n]*)/] },
  { page: 'Rarity', quotes: [/(\{\{c\|rare\|Rare\}\} items can have up to six[^\n]*)/] },
  {
    page: 'Desecrated_modifier',
    quotes: [/(granting a choice of one of three modifiers\.)/, /(\* Sceptres do not have exclusive desecrated prefixes or suffixes\.)/],
  },
];

interface WikiEvidence {
  id: string;
  sourceName: 'PoE2 Wiki';
  sourceUrl: string;
  observedVersion: string;
  retrievedAt: string;
  sha256: string;
  evidenceLevel: 'VERIFIED_SECONDARY';
  notes: string;
}

const clean = (text: string): string =>
  text
    .replace(/<ref>.*?<\/ref>/g, '')
    .replace(/<br>/g, ' ')
    .replace(/\{\{il\|([^}]*)\}\}/g, '$1')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{c\|\w+\|([^}]*)\}\}/g, '$1')
    .replace(/'''/g, '')
    .trim();

async function main(): Promise<void> {
  const retrievedAt = new Date().toISOString();
  const records: WikiEvidence[] = [];
  for (const { page, quotes } of PAGES) {
    const url = `${API}?action=parse&page=${encodeURIComponent(page)}&prop=wikitext|revid&format=json&redirects=1`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`GET ${url} -> HTTP ${response.status}`);
    const body = await response.text();
    const parsed = JSON.parse(body) as { parse?: { revid: number; wikitext: { '*': string } } };
    const wiki = parsed.parse;
    if (!wiki) throw new Error(`Wiki page ${page} not found`);
    const excerpts = quotes.map((quote) => {
      const match = wiki.wikitext['*'].match(quote);
      if (!match?.[1]) throw new Error(`Evidence quote ${quote} not found on ${page}`);
      return clean(match[1]);
    });
    records.push({
      id: `wiki:${page}`,
      sourceName: 'PoE2 Wiki',
      sourceUrl: `https://www.poe2wiki.net/index.php?title=${page}&oldid=${wiki.revid}`,
      observedVersion: `rev ${wiki.revid}`,
      retrievedAt,
      sha256: createHash('sha256').update(body).digest('hex'),
      evidenceLevel: 'VERIFIED_SECONDARY',
      notes: excerpts.join(' … '),
    });
    console.log(`${page} rev ${wiki.revid}`);
  }
  const target = join('data-source', 'rules', 'evidence-wiki.json');
  writeFileSync(target, `${JSON.stringify(records, null, 2)}\n`);
  console.log(`Wrote ${target}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
