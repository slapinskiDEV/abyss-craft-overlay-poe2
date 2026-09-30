// View-model: evaluation -> display rows (spec 006). Pure; no React, no domain logic beyond
// presentation (filtering, union coverage, grouping labels).
import type {
  BlockedModifierCandidate,
  ConditionalModifierCandidate,
  DesecrationBranchResult,
  DesecrationEvaluation,
  ModifierCandidate,
  PoolCompleteness,
} from '../../domain/desecration/types';
import type { GameLocalizationProvider } from '../../i18n/game/providers/types';

export type ModifierCategoryId = 'regular' | 'exclusive' | `lich:${string}` | `special:${string}`;
export type ModifierView = 'eligible' | 'conditional' | 'blocked';

export interface ModifierFilters {
  text: string;
  sides: Array<'prefix' | 'suffix'>;
  categories: ModifierCategoryId[]; // empty = all
  minLevel?: number;
  maxLevel?: number;
  showBaseIneligible: boolean;
}

export const DEFAULT_FILTERS: ModifierFilters = { text: '', sides: ['prefix', 'suffix'], categories: [], showBaseIneligible: false };

export interface ModifierRow {
  modifierId: string;
  text: string;
  side: 'prefix' | 'suffix';
  requiredLevel: number;
  tierFamilyId: string;
  categories: ModifierCategoryId[];
  coverage: { count: number; of: number };
  reasons: Array<{ code: string; params?: Record<string, unknown> }>;
  notes: string[];
}

export function categoriesOf(c: Pick<ModifierCandidate, 'sourceKind' | 'lichPool' | 'specialPools'>): ModifierCategoryId[] {
  const out: ModifierCategoryId[] = [c.sourceKind === 'regular' ? 'regular' : 'exclusive'];
  if (c.lichPool) out.push(`lich:${c.lichPool}`);
  for (const p of c.specialPools) out.push(`special:${p}`);
  return out;
}

const pick = (b: DesecrationBranchResult, view: ModifierView): Array<ModifierCandidate | ConditionalModifierCandidate | BlockedModifierCandidate> =>
  view === 'eligible' ? b.eligible : view === 'conditional' ? b.conditional : b.blocked;

/** Branch lists the modifier view can show: the exact item check or the base pool (spec 009). */
export type PoolBranches = Pick<DesecrationEvaluation, 'branches'>;
export type PoolSource = 'item' | 'base';

export const poolBranches = (evaluation: DesecrationEvaluation, source: PoolSource): PoolBranches => ({
  branches: source === 'base' ? evaluation.basePool.sides : evaluation.branches,
});

/**
 * Default source: the exact item pool when it can list anything (it knows the current blockers);
 * otherwise the base pool when one exists (SoT §14.7); null when nothing may be listed.
 */
export function defaultPoolSource(evaluation: DesecrationEvaluation): PoolSource | null {
  if (evaluation.branches.length > 0 && evaluation.poolCompleteness !== 'unknown') return 'item';
  if (evaluation.basePool.sides.length > 0) return 'base';
  return evaluation.branches.length > 0 ? 'item' : null;
}

/**
 * Filter chips offered by the UI: only categories that occur in the evaluation (data-driven), or in
 * the given view's lists when a view is passed.
 */
export function availableCategories(evaluation: PoolBranches | null, view?: ModifierView): ModifierCategoryId[] {
  const seen = new Set<ModifierCategoryId>();
  for (const b of evaluation?.branches ?? []) {
    for (const c of view ? pick(b, view) : [...b.eligible, ...b.conditional, ...b.blocked]) for (const cat of categoriesOf(c)) seen.add(cat);
  }
  const order = (c: string) => (c === 'regular' ? 0 : c === 'exclusive' ? 1 : c.startsWith('lich:') ? 2 : 3);
  return [...seen].sort((a, b) => order(a) - order(b) || a.localeCompare(b));
}

export function weakestCompleteness(branches: readonly DesecrationBranchResult[]): PoolCompleteness {
  const rank: Record<PoolCompleteness, number> = { final: 0, base_eligibility_only: 1, unknown: 2 };
  if (branches.length === 0) return 'unknown';
  return branches.reduce<PoolCompleteness>((w, b) => (rank[b.completeness] > rank[w] ? b.completeness : w), 'final');
}

/** i18n key of the pool heading; null when no pool may be shown (SoT §1.4, §9.4, §14.7). */
export function poolHeadingKey(completeness: PoolCompleteness, source: PoolSource = 'item'): string | null {
  if (source === 'base') return completeness === 'unknown' ? null : 'workspace:basePoolHeading';
  return completeness === 'final' ? 'workspace:eligiblePoolHeading' : completeness === 'base_eligibility_only' ? 'workspace:baseEligibilityHeading' : null;
}


export function buildRows(
  evaluation: PoolBranches,
  branchId: string | 'union',
  view: ModifierView,
  filters: ModifierFilters,
  game: GameLocalizationProvider,
): ModifierRow[] {
  const branches = branchId === 'union' ? evaluation.branches : evaluation.branches.filter((b) => b.id === branchId);
  const total = branches.length;
  const rows = new Map<string, ModifierRow>();
  for (const b of branches) {
    if (b.completeness === 'unknown') continue;
    for (const c of pick(b, view)) {
      const existing = rows.get(c.modifierId);
      if (existing) {
        existing.coverage.count += 1;
        continue;
      }
      rows.set(c.modifierId, {
        modifierId: c.modifierId,
        text: game.modifierText(c.modifierId).text,
        side: c.side,
        requiredLevel: c.requiredLevel,
        tierFamilyId: c.tierFamilyId,
        categories: categoriesOf(c),
        coverage: { count: 1, of: total },
        reasons: 'reasons' in c ? c.reasons : 'unresolvedAffixIndexes' in c ? [{ code: 'POSSIBLY_BLOCKED_BY_UNRESOLVED_AFFIX' }] : [],
        notes: c.notes,
      });
    }
  }
  const needle = filters.text.trim().toLowerCase();
  return [...rows.values()]
    .filter((r) => filters.sides.includes(r.side))
    .filter((r) => filters.categories.length === 0 || r.categories.some((c) => filters.categories.includes(c)))
    .filter((r) => (filters.minLevel === undefined || r.requiredLevel >= filters.minLevel) && (filters.maxLevel === undefined || r.requiredLevel <= filters.maxLevel))
    .filter((r) => needle === '' || r.text.toLowerCase().includes(needle))
    // Rows blocked only because the base cannot roll them stay hidden unless asked for or searched.
    .filter((r) => view !== 'blocked' || filters.showBaseIneligible || needle !== '' || !r.reasons.every((x) => x.code === 'BASE_TAG_NOT_ELIGIBLE'))
    .sort((a, b) => a.side.localeCompare(b.side) || a.categories[0]!.localeCompare(b.categories[0]!) || a.text.localeCompare(b.text) || b.requiredLevel - a.requiredLevel);
}

/**
 * Display names for Lich / special pool categories: the official English family names used by the
 * SoT (§7.5–7.7). They are game terms, so they stay English in every UI locale (SoT §5.2).
 */
const POOL_NAMES: Record<string, string> = {
  'lich:amanamu': 'Amanamu',
  'lich:ulaman': 'Ulaman',
  'lich:kurgal': 'Kurgal',
  'special:otherworldly': 'Otherworldly',
  'special:jewel_lightless': 'Lightless',
  'special:jewel_of_the_abyss': 'of the Abyss',
};
export const poolCategoryName = (c: ModifierCategoryId): string | undefined => POOL_NAMES[c];
