// EN clipboard adapter (spec 004 pipeline). Structural tokens come from EN_GRAMMAR; every entity
// name is resolved through the data pack. Nothing is guessed: ambiguity stays visible.
import type { AffixSide, BaseItemDefinition, DataPack, ModifierDefinition } from '../../data/normalized/types';
import { isOrdinarilySpawnable } from '../../domain/modifiers/spawn-weight';
import { AffixMatcher, summarize, type AffixCandidates } from '../common/affix-matcher';
import { StatMatcher, type StatMatch } from '../common/stat-matcher';
import { normalizeClipboard, splitSections, type Line } from '../common/text';
import type {
  ClipboardParserAdapter,
  ClipboardParserAdapterDefinition,
  ParsedAffix,
  ParsedItem,
  ParsedItemResult,
  ParserConfidence,
  ParserDiagnostic,
  TriState,
} from '../common/types';
import { EN_GRAMMAR as G, isConfirmed, U014_REGULAR_REVEAL_DETECTABLE, type GrammarToken } from './grammar';

type Rarity = ParsedItem['rarity'];

interface RawAffix {
  lines: string[];
  lineIndex: number;
  side?: AffixSide; // from the advanced block header
  name?: string;
  tier?: number;
  fractured: boolean;
  crafted: boolean;
  desecrated: boolean;
}

interface BaseResolution {
  text: string;
  reason?: 'not_found' | 'ambiguous';
  tags?: string[];
  domain?: string;
  id?: string;
}

const LABELS = [G.labels.itemClass, G.labels.rarity, G.labels.itemLevel];
const matches = (token: GrammarToken, text: string): boolean =>
  typeof token.value === 'string' ? text === token.value : token.value.test(text);

export function createEnAdapter(pack: DataPack): ClipboardParserAdapter {
  const stats = new StatMatcher(pack.statTranslationsEn);
  const affixes = new AffixMatcher(pack, stats);
  const basesById = new Map(pack.baseItems.map((b) => [b.id, b]));
  const exclusiveIds = new Set(pack.modifiers.filter((m) => m.sourceKind === 'desecrated_exclusive').map((m) => m.id));
  const markIds = new Set(pack.abyssMarkModifierIds);
  const specialUniqueNames = new Set(pack.specialItems.filter((s) => s.handling === 'unsupported_special_item').flatMap((s) => s.uniqueNamesEn));
  const timeLostBaseIds = new Set(pack.specialItems.filter((s) => s.handling === 'special_jewel_rule').flatMap((s) => s.baseItemIds));

  const detect = (raw: string): number => {
    const lines = normalizeClipboard(raw);
    const hits = LABELS.filter((label) => lines.some((l) => l.startsWith(label.value))).length;
    return hits / LABELS.length;
  };

  const parse = (raw: string): ParsedItemResult => {
    const diagnostics: ParserDiagnostic[] = [];
    const unconfirmedUsed = new Set<string>();
    const use = (name: string, token: GrammarToken) => {
      if (!isConfirmed(token)) unconfirmedUsed.add(name);
    };
    const lines = normalizeClipboard(raw);
    const sections = splitSections(lines, (l) => l === G.separator.value);
    use('separator', G.separator);
    const header = sections[0] ?? [];

    // --- header ---------------------------------------------------------------------------
    const labelValue = (label: GrammarToken<string>): string | undefined => {
      use(label.value, label);
      return lines.find((l) => l.startsWith(label.value))?.slice(label.value.length).trim();
    };
    const classText = labelValue(G.labels.itemClass);
    const rarityText = labelValue(G.labels.rarity);
    const itemLevelText = labelValue(G.labels.itemLevel);
    const rarityEntry = Object.entries(G.rarityValues).find(([, t]) => t.value === rarityText);
    const rarity: Rarity = (rarityEntry?.[0] as Rarity | undefined) ?? 'unknown';
    if (rarityEntry) use(`rarity:${rarityEntry[0]}`, rarityEntry[1]);

    const classIds = classText ? pack.nameIndexEn.itemClassesByName[classText] ?? [] : [];
    const itemClassId = classIds.length === 1 ? classIds[0] : undefined;
    if (!itemClassId) diagnostics.push({ code: 'ITEM_CLASS_UNRESOLVED', severity: 'error', params: { text: classText ?? '' } });

    const nameLines = header.filter((l) => !LABELS.some((label) => l.text.startsWith(label.value))).map((l) => l.text);
    const unidentified = lines.some((l) => matches(G.flags.unidentified, l));
    const base = resolveBase(nameLines, rarity, itemClassId);
    if (!base.tags) diagnostics.push({ code: 'BASE_TYPE_UNRESOLVED', severity: 'error', params: { text: base.text, reason: base.reason ?? '' } });

    const itemLevel = itemLevelText !== undefined && /^\d+$/.test(itemLevelText) ? Number(itemLevelText) : undefined;
    if (itemLevel === undefined) diagnostics.push({ code: 'ITEM_LEVEL_MISSING', severity: 'error' });

    // --- flags ----------------------------------------------------------------------------
    const flag = (name: keyof typeof G.flags): boolean => {
      const seen = lines.some((l) => matches(G.flags[name], l));
      if (seen) use(`flag:${name}`, G.flags[name]);
      return seen;
    };
    const corrupted = flag('corrupted');
    const mirrored = flag('mirrored');
    if (unidentified) use('flag:unidentified', G.flags.unidentified);

    // --- affixes --------------------------------------------------------------------------
    const bodySections = sections.slice(1);
    const advanced = bodySections.some((s) => s.some((l) => G.advancedBlock.header.value.test(l.text)));
    const unrevealed: Array<{ side: AffixSide }> = [];
    const rawAffixes = advanced ? readAdvanced(bodySections, use) : readNormal(bodySections, unrevealed, use);
    if (!advanced && rawAffixes.length > 0) diagnostics.push({ code: 'NORMAL_COPY_LIMITED_DETAIL', severity: 'info' });

    const baseDomain = base.domain;
    // Spec 004 step 7. An exclusive counts only where the engine's pool would allow it (its spawn
    // weights on the base tags, or the Otherworldly jewellery classes): an exclusive of another base
    // must not mark the item as already Desecrated (spec 017 C2). Regular rows stay domain-wide:
    // the Mark and other non-rolling regular rows have zero ordinary weight but occur on items.
    const baseTags = new Set(base.tags);
    const plausible = (m: ModifierDefinition): boolean =>
      m.sourceKind === 'desecrated_exclusive'
        ? m.specialPools.includes('otherworldly')
          ? m.otherworldlyJewelleryClasses.some((t) => baseTags.has(t))
          : isOrdinarilySpawnable(m.spawnWeights, baseTags)
        : m.domain === baseDomain;
    const parsedAffixes = advanced
      ? rawAffixes.map((a) => toParsedAffix(a, candidatesForBlock(a, plausible), use))
      : readNormalAffixes(rawAffixes, plausible, diagnostics);

    const prefixes = parsedAffixes.filter((a) => a.side === 'prefix');
    const suffixes = parsedAffixes.filter((a) => a.side === 'suffix');
    const unknownAffixes = parsedAffixes.filter((a) => a.side === 'unknown');
    for (const a of parsedAffixes) {
      if (a.candidateModifierIds.length === 0) diagnostics.push({ code: 'AFFIX_UNRESOLVED', severity: 'warning', params: { text: a.rawLines.join(' / ') } });
      else if (!a.matchedModifierId) diagnostics.push({ code: 'AFFIX_AMBIGUOUS', severity: 'info', params: { text: a.rawLines.join(' / '), candidates: a.candidateModifierIds.length } });
      if (a.side === 'unknown') diagnostics.push({ code: 'AFFIX_SIDE_UNKNOWN', severity: 'warning', params: { text: a.rawLines.join(' / ') } });
    }

    // --- Abyss state ----------------------------------------------------------------------
    const exclusiveMatch = parsedAffixes.find((a) => a.candidateModifierIds.length > 0 && a.candidateModifierIds.every((id) => isExclusive(id)));
    const markerSeen = unrevealed.length > 0 || parsedAffixes.some((a) => a.desecrated);
    const markerTokens = advanced ? [G.affixMarkers.desecrated] : [G.affixMarkers.desecrated, G.unrevealed.prefix, G.unrevealed.suffix];
    const markersConfirmed = markerTokens.every(isConfirmed);
    let existingDesecration: TriState;
    if (exclusiveMatch || (markerSeen && markersConfirmed)) existingDesecration = 'present';
    else if (!markerSeen && markersConfirmed && U014_REGULAR_REVEAL_DETECTABLE) existingDesecration = 'absent';
    else existingDesecration = 'undetermined';
    if (existingDesecration === 'undetermined') diagnostics.push({ code: 'DESECRATED_STATE_UNDETERMINED', severity: 'warning', params: { uRef: 'U-014' } });
    const revealedAffix = parsedAffixes.find((a) => a.desecrated) ?? exclusiveMatch;

    const markAffixes = parsedAffixes.filter((a) => a.isMarkOfAbyssalLord);
    const markMixed = parsedAffixes.some((a) => !a.isMarkOfAbyssalLord && a.candidateModifierIds.some((id) => markIds.has(id)));
    const anyUnbounded = parsedAffixes.some((a) => a.candidateModifierIds.length === 0);
    const markState: TriState = markAffixes.length > 0 ? 'present' : markMixed || anyUnbounded ? 'undetermined' : 'absent';
    if (markMixed) diagnostics.push({ code: 'MARK_UNRESOLVED', severity: 'warning' });
    const markSide = markAffixes[0]?.side;

    const fracturedTokens = [G.affixMarkers.fractured];
    const fracturedState = fracturedTokens.every(isConfirmed) ? 'determined' : 'undetermined';

    const itemName = rarity === 'rare' || rarity === 'unique' ? nameLines[0] : undefined;
    const isSpecial = rarity === 'unique' && itemName !== undefined && specialUniqueNames.has(itemName);
    if (isSpecial) diagnostics.push({ code: 'SPECIAL_ITEM_DETECTED', severity: 'info', params: { name: itemName } });
    const isTimeLostJewel = base.id !== undefined && timeLostBaseIds.has(base.id);
    if (isTimeLostJewel && base.id) diagnostics.push({ code: 'TIME_LOST_JEWEL_DETECTED', severity: 'info', params: { baseItemId: base.id, uRef: 'U-006' } });

    for (const name of [...unconfirmedUsed].sort()) diagnostics.push({ code: 'MARKER_UNCONFIRMED', severity: 'info', params: { token: name, uRef: 'U-011' } });

    const item: ParsedItem = {
      parserLocale: 'en',
      copyMode: rawAffixes.length === 0 && unrevealed.length === 0 ? 'unknown' : advanced ? 'advanced' : 'normal',
      rawText: raw,
      rarity,
      ...(itemName !== undefined ? { itemName } : {}),
      baseTypeText: base.text,
      ...(base.id !== undefined ? { baseItemId: base.id } : {}),
      ...(itemClassId !== undefined ? { itemClassId } : {}),
      ...(itemLevel !== undefined ? { itemLevel } : {}),
      baseTags: base.tags ?? [],
      corrupted,
      mirrored,
      unidentified,
      prefixes,
      suffixes,
      unknownAffixes,
      fracturedState,
      abyss: {
        hasUnrevealedDesecratedModifier: unrevealed.length > 0,
        hasRevealedDesecratedModifier: revealedAffix !== undefined,
        ...(unrevealed[0] ? { desecratedSide: unrevealed[0].side } : revealedAffix && revealedAffix.side !== 'unknown' ? { desecratedSide: revealedAffix.side } : {}),
        hasMarkOfAbyssalLord: markAffixes.length > 0,
        ...(markSide && markSide !== 'unknown' ? { markSide } : {}),
        isSpecialMultiDesecrationItem: isSpecial,
        existingDesecration,
        markState,
      },
      isTimeLostJewel,
    };

    const affixDecisionUnconfirmed = parsedAffixes.length > 0 && (advanced ? !isConfirmed(G.advancedBlock.header) : true);
    const confidence: ParserConfidence =
      !itemClassId || !base.tags || itemLevel === undefined
        ? 'insufficient'
        : parsedAffixes.every((a) => a.side !== 'unknown' && a.groupsResolved) && !affixDecisionUnconfirmed
          ? 'full'
          : 'partial';

    if (confidence === 'insufficient') return { ok: false, confidence, diagnostics };
    return { ok: true, item, confidence, diagnostics };
  };

  function isExclusive(id: string): boolean {
    return exclusiveIds.has(id);
  }

  function resolveBase(nameLines: string[], rarity: Rarity, itemClassId: string | undefined): BaseResolution {
    const inClass = (ids: readonly string[]): BaseItemDefinition[] =>
      ids.map((id) => basesById.get(id)).filter((b): b is BaseItemDefinition => b !== undefined && b.itemClassId === itemClassId);
    // Rare/unique: the last name line is the base; magic/normal: the base is embedded in the line.
    const text = nameLines.at(-1) ?? '';
    let found = inClass(pack.nameIndexEn.baseItemsByName[text] ?? []);
    if (found.length === 0 && (rarity === 'magic' || rarity === 'normal')) {
      const names = Object.keys(pack.nameIndexEn.baseItemsByName)
        .filter((n) => text.includes(n) && inClass(pack.nameIndexEn.baseItemsByName[n] ?? []).length > 0)
        .sort((a, b) => b.length - a.length);
      const longest = names[0];
      if (longest) found = inClass(pack.nameIndexEn.baseItemsByName[longest] ?? []);
    }
    // Only unique items can use unique_only bases (data semantics of releaseState).
    if (rarity !== 'unique') found = found.filter((b) => b.releaseState !== 'unique_only');
    const tagKeys = new Set(found.map((b) => [...b.tags].sort().join('|')));
    const [first] = found;
    if (!first) return { text, reason: 'not_found' };
    if (tagKeys.size > 1) return { text, reason: 'ambiguous' };
    return {
      text,
      tags: first.tags,
      domain: first.domain,
      ...(found.length === 1 ? { id: first.id } : {}),
    };
  }

  function candidatesForBlock(a: RawAffix, plausible: (m: ModifierDefinition) => boolean): AffixCandidates {
    const mods = new Map<string, ModifierDefinition>();
    for (const seg of affixes.segmentations(a.lines)) {
      for (const m of affixes.modsFor(seg, (mod) => plausible(mod) && (!a.side || mod.side === a.side) && (!a.name || mod.canonicalNameEn === a.name))) {
        mods.set(m.id, m);
      }
    }
    return summarize([...mods.values()]);
  }

  function toParsedAffix(a: RawAffix, c: AffixCandidates, use: (n: string, t: GrammarToken) => void): ParsedAffix {
    if (a.side) use('advancedBlock', G.advancedBlock.header);
    const [only] = c.candidateModifierIds;
    const side: ParsedAffix['side'] = a.side ?? c.impliedSide ?? 'unknown';
    return {
      rawLines: a.lines,
      side,
      ...(c.candidateModifierIds.length === 1 && only ? { matchedModifierId: only } : {}),
      groups: c.groupsResolved ? c.possibleGroups : [],
      fractured: a.fractured,
      crafted: a.crafted,
      desecrated: a.desecrated,
      candidateModifierIds: c.candidateModifierIds,
      groupsResolved: c.groupsResolved,
      possibleGroups: c.possibleGroups,
      addsTagsResolved: c.addsTagsResolved,
      isMarkOfAbyssalLord: c.candidateModifierIds.length > 0 && c.candidateModifierIds.every((id) => markIds.has(id)),
      ...(a.name !== undefined || a.tier !== undefined ? { advanced: { ...(a.name !== undefined ? { name: a.name } : {}), ...(a.tier !== undefined ? { tier: a.tier } : {}) } } : {}),
    };
  }

  function readNormalAffixes(rawAffixes: RawAffix[], plausible: (m: ModifierDefinition) => boolean, diagnostics: ParserDiagnostic[]): ParsedAffix[] {
    // Normal copy: every line is explicit; hybrid mods may span lines. Only a unique split of the
    // lines into affixes is accepted (SoT §9.5). Counted by dynamic programming from the last line
    // (splits from each position, capped at 2) instead of enumerating every split, which grew
    // exponentially when no split existed (spec 017 C1).
    const lineTexts = rawAffixes.flatMap((a) => a.lines);
    const lineMeta = rawAffixes.flatMap((a) => a.lines.map(() => a));
    const n = lineTexts.length;
    const modsIn = (start: number, end: number): ModifierDefinition[] => {
      const mods = new Map<string, ModifierDefinition>();
      for (const seg of affixes.segmentations(lineTexts.slice(start, end))) for (const m of affixes.modsFor(seg, plausible)) mods.set(m.id, m);
      return [...mods.values()];
    };
    const splitsFrom = new Array<number>(n + 1).fill(0);
    const firstEnd = new Array<number>(n + 1).fill(-1);
    const modsFrom = new Array<ModifierDefinition[]>(n + 1).fill([]);
    splitsFrom[n] = 1;
    for (let start = n - 1; start >= 0; start -= 1) {
      for (let end = start + 1; end <= Math.min(n, start + 3); end += 1) {
        if ((splitsFrom[end] ?? 0) === 0) continue;
        const mods = modsIn(start, end);
        if (mods.length === 0) continue;
        splitsFrom[start] = Math.min(2, (splitsFrom[start] ?? 0) + (splitsFrom[end] ?? 0));
        firstEnd[start] = end;
        modsFrom[start] = mods;
      }
    }
    if (splitsFrom[0] !== 1) {
      if (n > 0) diagnostics.push({ code: 'AFFIX_AMBIGUOUS', severity: 'warning', params: { splits: splitsFrom[0] ?? 0 } });
      return rawAffixes.map((a) => toParsedAffix({ ...a, side: undefined }, summarize([]), () => undefined));
    }
    // Exactly one split: from each position on it, exactly one end continues to a full split.
    const out: ParsedAffix[] = [];
    for (let start = 0; start < n; start = firstEnd[start] as number) {
      const end = firstEnd[start] as number;
      const meta = lineMeta[start] as RawAffix;
      const group: RawAffix = { ...meta, lines: lineTexts.slice(start, end), side: undefined };
      out.push(toParsedAffix(group, summarize(modsFrom[start] ?? []), () => undefined));
    }
    return out;
  }

  return { locale: 'en', detect, parse };
}

// --- section readers ------------------------------------------------------------------------

const cleanValueLine = (text: string): string =>
  text.replace(G.advancedValueRange.value, '$1').replace(G.unscalableSuffix.value, '').trim();

function readAdvanced(sections: Line[][], use: (n: string, t: GrammarToken) => void): RawAffix[] {
  const out: RawAffix[] = [];
  for (const section of sections) {
    let current: RawAffix | null = null;
    for (const line of section) {
      const header = line.text.match(G.advancedBlock.header.value);
      if (header) {
        const type = header.groups?.type ?? '';
        const side: AffixSide | undefined = type.includes(G.advancedBlock.prefixWord.value)
          ? 'prefix'
          : type.includes(G.advancedBlock.suffixWord.value)
            ? 'suffix'
            : undefined;
        current = side
          ? {
              lines: [],
              lineIndex: line.index,
              side,
              ...(header.groups?.name ? { name: header.groups.name } : {}),
              ...(header.groups?.tier ? { tier: Number(header.groups.tier) } : {}),
              fractured: type.includes(G.affixMarkers.fractured.value),
              crafted: type.includes(G.affixMarkers.crafted.value),
              desecrated: type.includes(G.affixMarkers.desecrated.value),
            }
          : null; // implicit / unique / enchant blocks are not explicit affixes
        if (current) {
          use('advancedBlock', G.advancedBlock.header);
          out.push(current);
        }
        continue;
      }
      if (current) current.lines.push(cleanValueLine(line.text));
    }
  }
  return out.filter((a) => a.lines.length > 0);
}

function readNormal(
  sections: Line[][],
  unrevealed: Array<{ side: AffixSide }>,
  use: (n: string, t: GrammarToken) => void,
): RawAffix[] {
  const out: RawAffix[] = [];
  const isProperty = (t: string) => /^[^:]{1,40}: /.test(t);
  const flagTokens = Object.values(G.flags);
  for (const section of sections) {
    for (const line of section) {
      const t = line.text;
      if (t === G.unrevealed.prefix.value || t === G.unrevealed.suffix.value) {
        use('unrevealed', t === G.unrevealed.prefix.value ? G.unrevealed.prefix : G.unrevealed.suffix);
        unrevealed.push({ side: t === G.unrevealed.prefix.value ? 'prefix' : 'suffix' });
        continue;
      }
      if (isProperty(t) || flagTokens.some((f) => matches(f, t)) || G.nonExplicitLineSuffix.value.test(t) || t.startsWith('Requires')) continue;
      const marker = t.match(/\((fractured|crafted|desecrated)\)$/i);
      const markerName = marker?.[1]?.toLowerCase() as keyof typeof G.affixMarkers | undefined;
      if (markerName) use(`marker:${markerName}`, G.affixMarkers[markerName]);
      out.push({
        lines: [cleanValueLine(t.replace(/\s*\((fractured|crafted|desecrated)\)$/i, ''))],
        lineIndex: line.index,
        fractured: marker?.[1]?.toLowerCase() === 'fractured',
        crafted: marker?.[1]?.toLowerCase() === 'crafted',
        desecrated: marker?.[1]?.toLowerCase() === 'desecrated',
      });
    }
  }
  return out;
}

export const EN_PARSER_ADAPTER: ClipboardParserAdapterDefinition = { locale: 'en', threshold: 2 / 3, create: createEnAdapter };
