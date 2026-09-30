// Axis 2 — game-term locales (SoT §5.2, §5.5, §6.4).
import type { DataPack } from '../../../data/normalized/types';

export interface LocalizedTerm {
  text: string;
  locale: string; // locale actually used
  fallback: boolean; // true when the requested locale lacked the term (or the entity is unknown)
}

export interface GameTermDiagnostic {
  code: 'GAME_TERM_FALLBACK_EN' | 'GAME_TERM_MISSING';
  params: { entityId: string };
}

export interface GameLocalizationProvider {
  readonly locale: string;
  currencyName(id: string): LocalizedTerm;
  omenName(id: string): LocalizedTerm;
  baseItemName(id: string): LocalizedTerm;
  itemClassName(id: string): LocalizedTerm;
  /** Official name of a Lich or special pool category (`lich:<pool>`, `special:<pool>`). */
  poolName(poolId: string): LocalizedTerm;
  /** Official modifier text with value ranges, e.g. "+(10-20) to Strength". */
  modifierText(modId: string): LocalizedTerm;
  /** Diagnostics recorded so far, one per entity ID (visible in the debug report). */
  diagnostics(): readonly GameTermDiagnostic[];
}

export interface GameTermProviderDefinition {
  locale: string;
  create(pack: DataPack): GameLocalizationProvider;
}
