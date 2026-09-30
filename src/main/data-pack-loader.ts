// Bundled data-pack loading with integrity checks (spec 001, 008). No fallback catalog.
import { existsSync, readFileSync } from 'node:fs';
import { computeDataPackId } from '../data/adapters/build-pack';
import { DATA_PACK_SCHEMA_VERSION, type DataPack } from '../data/normalized/types';
import type { DataPackLoadResult } from '../preload/api-types';

export function loadDataPackFile(path: string): DataPackLoadResult {
  if (!existsSync(path)) return { ok: false, code: 'DATA_PACK_MISSING' };
  let pack: DataPack;
  try {
    pack = JSON.parse(readFileSync(path, 'utf8')) as DataPack;
  } catch {
    return { ok: false, code: 'DATA_PACK_INTEGRITY_FAILED' };
  }
  if (pack.manifest?.schemaVersion !== DATA_PACK_SCHEMA_VERSION) return { ok: false, code: 'DATA_PACK_SCHEMA_UNSUPPORTED' };
  const { manifest, ...content } = pack;
  if (computeDataPackId(content) !== manifest.dataPackId) return { ok: false, code: 'DATA_PACK_INTEGRITY_FAILED' };
  if (manifest.validated !== true) return { ok: false, code: 'DATA_PACK_NOT_VALIDATED' };
  return { ok: true, pack };
}
