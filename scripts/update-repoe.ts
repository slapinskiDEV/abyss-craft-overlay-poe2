// Fetches an accepted RePoE PoE2 snapshot and archives it with hashes (SoT §6.2, §6.6, §6.7).
// This is the only networked script; runtime code never fetches (SoT §6.1).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const EXPORT_BASE = 'https://repoe-fork.github.io/poe2/';
const VERSION_URL = 'https://raw.githubusercontent.com/repoe-fork/poe2/master/version.txt';

// Published paths relative to EXPORT_BASE. Minified variants carry the same data.
export const SNAPSHOT_FILES = [
  'base_items.min.json',
  'mods.min.json',
  'mods_by_base.min.json',
  'item_classes.min.json',
  'tags.min.json',
  'tag_details.min.json',
  'uniques.min.json',
  'stat_translations/stat_descriptions.min.json',
  'stat_translations/advanced_mod_stat_descriptions.min.json',
] as const;

export interface SnapshotFileRecord {
  id: string;
  path: string;
  url: string;
  sha256: string;
  bytes: number;
}

export interface SnapshotRecord {
  sourceName: 'RePoE PoE2';
  observedVersion: string;
  versionUrl: string;
  retrievedAt: string;
  files: SnapshotFileRecord[];
}

const sha256 = (data: Uint8Array): string => createHash('sha256').update(data).digest('hex');

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} -> HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function main(): Promise<void> {
  const observedVersion = new TextDecoder().decode(await fetchBytes(VERSION_URL)).trim();
  if (!/^[\w.-]+$/.test(observedVersion)) throw new Error(`Unexpected version.txt content: ${observedVersion}`);

  const retrievedAt = new Date().toISOString();
  const dirName = `${retrievedAt.slice(0, 10)}-${observedVersion}`;
  const outDir = join('data-source', 'snapshots', dirName);
  if (existsSync(outDir)) throw new Error(`Snapshot ${outDir} already exists; snapshots are never overwritten.`);

  const files: SnapshotFileRecord[] = [];
  for (const path of SNAPSHOT_FILES) {
    const url = new URL(path, EXPORT_BASE).toString();
    const bytes = await fetchBytes(url);
    JSON.parse(new TextDecoder().decode(bytes)); // reject non-JSON responses before archiving
    const target = join(outDir, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
    files.push({ id: `repoe:${observedVersion}:${path}`, path, url, sha256: sha256(bytes), bytes: bytes.length });
    console.log(`${path}  ${bytes.length} B  ${files.at(-1)?.sha256}`);
  }

  const record: SnapshotRecord = { sourceName: 'RePoE PoE2', observedVersion, versionUrl: VERSION_URL, retrievedAt, files };
  writeFileSync(join(outDir, 'snapshot.json'), `${JSON.stringify(record, null, 2)}\n`);
  console.log(`Snapshot written to ${outDir}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
