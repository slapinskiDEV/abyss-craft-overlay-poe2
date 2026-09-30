// Parsed item model (SoT §8, §9.4; spec 004). Language-independent: IDs, never localized text,
// except raw lines kept for display/debug.
import type { AffixSide } from '../../data/normalized/types';

export type ParserConfidence = 'full' | 'partial' | 'insufficient';
export type TriState = 'present' | 'absent' | 'undetermined';

export interface ParsedAffix {
  rawLines: string[];
  side: AffixSide | 'unknown';
  matchedModifierId?: string;
  groups: string[];
  fractured: boolean;
  crafted: boolean;
  desecrated: boolean;
  // spec 004 additive fields
  candidateModifierIds: string[];
  groupsResolved: boolean;
  possibleGroups: string[];
  addsTagsResolved: boolean;
  isMarkOfAbyssalLord: boolean;
  /** Advanced-copy block metadata, when present. */
  advanced?: { name?: string; tier?: number };
}

export interface ParsedItem {
  parserLocale: string; // registered adapter locale ('en' in MVP) or 'unknown'
  copyMode: 'normal' | 'advanced' | 'unknown';
  rawText: string;
  rarity: 'normal' | 'magic' | 'rare' | 'unique' | 'unknown';
  itemName?: string;
  baseTypeText: string;
  baseItemId?: string;
  itemClassId?: string;
  itemLevel?: number;
  baseTags: string[];
  corrupted: boolean;
  mirrored: boolean;
  unidentified: boolean;
  prefixes: ParsedAffix[];
  suffixes: ParsedAffix[];
  unknownAffixes: ParsedAffix[];
  fracturedState: 'determined' | 'undetermined';
  abyss: {
    hasUnrevealedDesecratedModifier: boolean;
    /** Unrevealed placeholder lines seen per side (normal copy); each takes a slot (spec 017 C5). */
    unrevealedCount?: { prefix: number; suffix: number };
    hasRevealedDesecratedModifier: boolean;
    desecratedSide?: AffixSide;
    hasMarkOfAbyssalLord: boolean;
    markSide?: AffixSide;
    isSpecialMultiDesecrationItem: boolean;
    existingDesecration: TriState;
    markState: TriState;
  };
  isTimeLostJewel: boolean;
}

export type ParserCode =
  | 'NOT_A_POE2_ITEM'
  | 'UNSUPPORTED_CLIPBOARD_LOCALE'
  | 'BASE_TYPE_UNRESOLVED'
  | 'ITEM_CLASS_UNRESOLVED'
  | 'ITEM_LEVEL_MISSING'
  | 'AFFIX_UNRESOLVED'
  | 'AFFIX_AMBIGUOUS'
  | 'AFFIX_SIDE_UNKNOWN'
  | 'MARKER_UNCONFIRMED'
  | 'DESECRATED_STATE_UNDETERMINED'
  | 'MARK_UNRESOLVED'
  | 'SPECIAL_ITEM_DETECTED'
  | 'TIME_LOST_JEWEL_DETECTED'
  | 'NORMAL_COPY_LIMITED_DETAIL';

export interface ParserDiagnostic {
  code: ParserCode;
  severity: 'error' | 'warning' | 'info';
  params?: Record<string, string | number>;
  lineIndex?: number;
}

export type ParsedItemResult =
  | { ok: true; item: ParsedItem; confidence: ParserConfidence; diagnostics: ParserDiagnostic[] }
  | { ok: false; confidence: 'insufficient'; diagnostics: ParserDiagnostic[] };

export interface ClipboardParserAdapter {
  locale: string;
  /** 0..1 from structural labels only; never from UI language (SoT §9.3). */
  detect(raw: string): number;
  parse(raw: string): ParsedItemResult;
}

export interface ClipboardParserAdapterDefinition {
  locale: string;
  threshold: number;
  create(pack: import('../../data/normalized/types').DataPack): ClipboardParserAdapter;
}
