// Semantic diff between two data packs (SoT §7.9 list). Usage: tsx scripts/semantic-diff.ts <old> <new> [out.md]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { DataPack, ModifierDefinition } from '../src/data/normalized/types';

const [oldPath, newPath, outPath] = process.argv.slice(2);
if (!oldPath || !newPath) throw new Error('usage: semantic-diff <old pack> <new pack> [out.md]');
const load = (p: string): DataPack | null => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as DataPack) : null);
const before = load(oldPath);
const after = load(newPath);
if (!after) throw new Error(`${newPath} not found`);

const lines: string[] = [`# Semantic diff`, '', `- old: ${before?.manifest.dataPackId ?? '(none)'}`, `- new: ${after.manifest.dataPackId}`, ''];
const section = (title: string, items: string[]) => {
  lines.push(`## ${title} (${items.length})`, '', ...(items.length ? items.slice(0, 500).map((i) => `- ${i}`) : ['- none']), '');
};
const ids = <T extends { id: string }>(xs: T[] | undefined) => new Map((xs ?? []).map((x) => [x.id, x]));

const oldBases = ids(before?.baseItems);
const newBases = ids(after.baseItems);
section('Added base items', [...newBases.keys()].filter((k) => !oldBases.has(k)));
section('Removed base items', [...oldBases.keys()].filter((k) => !newBases.has(k)));

const oldMods = ids(before?.modifiers);
const newMods = ids(after.modifiers);
section('Added modifiers', [...newMods.keys()].filter((k) => !oldMods.has(k)));
section('Removed modifiers', [...oldMods.keys()].filter((k) => !newMods.has(k)));
const changed = (field: string, pick: (m: ModifierDefinition) => unknown) =>
  section(
    `Changed ${field}`,
    [...newMods.values()].flatMap((m) => {
      const o = oldMods.get(m.id);
      return o && JSON.stringify(pick(o)) !== JSON.stringify(pick(m)) ? [`${m.id}: ${JSON.stringify(pick(o))} -> ${JSON.stringify(pick(m))}`] : [];
    }),
  );
changed('required levels', (m) => m.requiredLevel);
changed('groups/types', (m) => [m.groups, m.modTypeId, m.tierFamilyId]);
changed('spawn weights', (m) => m.spawnWeights);
changed('source kind', (m) => m.sourceKind);
changed('Lich classification', (m) => [m.lichPool ?? null, m.lichPoolConflict]);
changed('Otherworldly membership', (m) => m.specialPools.includes('otherworldly'));

const defs = (p: DataPack | null) => JSON.stringify([p?.bones ?? [], p?.omens ?? [], p?.otherCurrencies ?? []]);
section('Bone/Omen currency definitions', defs(before) === defs(after) ? [] : ['definitions changed (see pack)']);

const text = `${lines.join('\n')}\n`;
if (outPath) writeFileSync(outPath, text);
else process.stdout.write(text);
