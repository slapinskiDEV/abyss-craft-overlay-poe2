import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { DesecrationBranchResult } from '../../domain';
import { diagnosticParams } from '../../i18n/format-diagnostic';
import {
  availableCategories,
  buildRows,
  poolCategoryName,
  poolHeadingKey,
  weakestCompleteness,
  type ModifierCategoryId,
  type ModifierFilters,
  type ModifierRow,
  type ModifierView,
  type PoolBranches,
  type PoolSource,
} from '../view-model/rows';
import { useGameTerms } from './game-terms';

interface Props {
  pool: PoolBranches;
  source: PoolSource;
  branchId: string | 'union';
  view: ModifierView;
  filters: ModifierFilters;
  /** Row previewed on the item (spec 006, SoT 0.2.9); clicking it again clears the preview. */
  selectedId: string | null;
  /** The only side with free slots, while the side filter shows just that side (spec 014). */
  openSideOnly?: 'prefix' | 'suffix' | undefined;
  onSelect: (row: ModifierRow) => void;
  onBranch: (id: string | 'union') => void;
  onView: (v: ModifierView) => void;
  onFilters: (patch: Partial<ModifierFilters>) => void;
}

const categoryClass = (c: ModifierCategoryId) => (c.startsWith('lich:') ? 'lich' : c.startsWith('special:') ? 'special' : c);

export function ModifierPanel({ pool, source, branchId, view, filters, selectedId, openSideOnly, onSelect, onBranch, onView, onFilters }: Props) {
  const { t } = useTranslation();
  const game = useGameTerms();
  // The base pool has one list per side; the side filter replaces branch tabs there.
  const isBase = source === 'base';
  const effectiveBranch = isBase ? 'union' : branchId;
  const selected = effectiveBranch === 'union' ? pool.branches : pool.branches.filter((b) => b.id === effectiveBranch);
  const completeness = weakestCompleteness(selected);
  const heading = poolHeadingKey(completeness, source);
  const rows = heading === null ? [] : buildRows(pool, effectiveBranch, view, filters, game);
  const categories = availableCategories(pool, view === 'blocked' ? undefined : view);
  const categoryLabel = (c: ModifierCategoryId) => (c === 'regular' || c === 'exclusive' ? t(`workspace:category.${c}`) : poolCategoryName(c) ?? c);
  const branchLabel = (b: DesecrationBranchResult) =>
    b.kind === 'mark_replacement'
      ? t('workspace:branchMarkReplaced')
      : b.kind === 'removal'
        ? t('workspace:branchRemoved', { text: (b.removedAffixRawText ?? []).join(' / ') })
        : t('workspace:branchOpenSlot', { side: t(`common:${b.side}`) });
  const eligibleTab = isBase ? t('workspace:tabPossible') : t(completeness === 'final' ? 'workspace:tabEligible' : 'workspace:tabBaseEligible');
  const countKey = isBase ? 'workspace:basePoolCount' : completeness === 'final' ? 'workspace:eligibleCount' : 'workspace:baseEligibleCount';
  const views: ModifierView[] = isBase ? ['eligible', 'blocked'] : ['eligible', 'conditional', 'blocked'];
  const sides = [...new Set(pool.branches.map((b) => b.side))];

  return (
    <section className="modifiers">
      {!isBase && pool.branches.length > 1 ? (
        <div className="branches" role="tablist" aria-label={t('workspace:removalOutcomes', { count: pool.branches.length })}>
          {pool.branches.map((b) => (
            <button key={b.id} type="button" role="tab" className="tab" aria-selected={branchId === b.id} onClick={() => onBranch(b.id)}>
              {branchLabel(b)}
            </button>
          ))}
          <button type="button" role="tab" className="tab" aria-selected={branchId === 'union'} onClick={() => onBranch('union')}>
            {t('workspace:union')}
          </button>
        </div>
      ) : null}
      {!isBase && branchId === 'union' && pool.branches.length > 1 ? <p className="disclaimer">{t('workspace:unionCoverageDisclaimer')}</p> : null}

      {heading === null ? (
        <p className="unknown-note">{t('workspace:unknownInteraction')}</p>
      ) : (
        <>
          <div className="pool-head">
            <h2>{t(heading)}</h2>
            {view === 'eligible' && completeness !== 'unknown' ? <span className="count">{t(countKey, { count: rows.length })}</span> : null}
          </div>
          {isBase ? <p className="note">{t('workspace:basePoolNote')}</p> : null}
          {!isBase && completeness === 'base_eligibility_only' ? <p className="banner warning">{t('workspace:baseEligibilityBanner')}</p> : null}
          <div className="toolbar">
            <div className="views" role="tablist">
              {views.map((v) => (
                <button key={v} type="button" role="tab" className="tab" aria-selected={view === v} onClick={() => onView(v)}>
                  {v === 'eligible' ? eligibleTab : t(v === 'conditional' ? 'workspace:tabConditional' : 'workspace:tabBlocked')}
                </button>
              ))}
            </div>
            <input className="search" type="search" aria-label={t('workspace:searchPlaceholder')} placeholder={t('workspace:searchPlaceholder')} value={filters.text} onChange={(e) => onFilters({ text: e.target.value })} />
          </div>
          <div className="filters">
            {sides.length > 1
              ? (['prefix', 'suffix'] as const).map((side) => {
                  const on = filters.sides.includes(side);
                  return (
                    <button key={side} type="button" className="chip small" aria-pressed={on} onClick={() => onFilters({ sides: on ? filters.sides.filter((s) => s !== side) : [...filters.sides, side] })}>
                      {t(`common:${side}`)}
                    </button>
                  );
                })
              : null}
            {categories.map((c) => {
              const on = filters.categories.includes(c);
              return (
                <button key={c} type="button" className={`chip small cat-${categoryClass(c)}`} aria-pressed={on} title={c === 'regular' || c === 'exclusive' ? t(`workspace:categoryHint.${c}`) : undefined} onClick={() => onFilters({ categories: on ? filters.categories.filter((x) => x !== c) : [...filters.categories, c] })}>
                  {categoryLabel(c)}
                </button>
              );
            })}
          </div>
          {openSideOnly && filters.sides.length === 1 && filters.sides[0] === openSideOnly ? (
            <p className="note side-note">{t('workspace:openSideOnly', { side: t(`common:${openSideOnly}`) })}</p>
          ) : null}
          <details className="more-filters">
            <summary>{t('workspace:moreFilters')}</summary>
            <div className="filters">
              <input type="number" aria-label={t('workspace:levelMin')} placeholder={t('workspace:levelMin')} value={filters.minLevel ?? ''} onChange={(e) => onFilters({ minLevel: e.target.value === '' ? undefined : Number(e.target.value) })} />
              <input type="number" aria-label={t('workspace:levelMax')} placeholder={t('workspace:levelMax')} value={filters.maxLevel ?? ''} onChange={(e) => onFilters({ maxLevel: e.target.value === '' ? undefined : Number(e.target.value) })} />
              <label className="toggle subtle">
                <input type="checkbox" checked={filters.showBaseIneligible} onChange={(e) => onFilters({ showBaseIneligible: e.target.checked })} />
                {t('workspace:showBaseIneligible')}
              </label>
            </div>
          </details>
          {rows.length === 0 ? (
            <p className="empty">{t('workspace:noModifiers')}</p>
          ) : (
            <ul className="rows">
              {rows.slice(0, 300).map((r) => (
                <li
                  key={r.modifierId}
                  data-modifier-id={r.modifierId}
                  className={`row side-${r.side}`}
                  {...(view === 'eligible'
                    ? {
                        role: 'button',
                        tabIndex: 0,
                        'aria-pressed': selectedId === r.modifierId,
                        onClick: () => onSelect(r),
                        onKeyDown: (e: KeyboardEvent) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelect(r);
                          }
                        },
                      }
                    : {})}
                >
                  <span className="text">{r.text}</span>
                  <span className="meta">
                    <span className={`side-tag ${r.side}`}>{t(`common:${r.side}`)}</span>
                    <span className="level">{t('workspace:requiredLevel', { level: r.requiredLevel })}</span>
                    {r.categories.filter((c) => c !== 'regular').map((c) => (
                      <span key={c} className={`cat cat-${categoryClass(c)}`}>
                        {categoryLabel(c)}
                      </span>
                    ))}
                    {!isBase && branchId === 'union' && r.coverage.of > 1 ? <span className="coverage">{t('workspace:coverage', r.coverage)}</span> : null}
                  </span>
                  {r.reasons.length > 0 ? (
                    <span className="reason" title={r.reasons.map((x) => t(`reasons:${x.code}.detail`, diagnosticParams({ code: x.code, params: x.params as never }, game))).join('\n')}>
                      {t(`reasons:${r.reasons[0]?.code}.title`, diagnosticParams({ code: r.reasons[0]?.code ?? '', params: r.reasons[0]?.params as never }, game))}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
