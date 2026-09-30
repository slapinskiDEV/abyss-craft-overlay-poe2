import { useEffect, useMemo, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DataPack } from '../../data/normalized/types';
import { affixSlots, boneOptions, defaultBoneId, defaultSides, evaluateDesecration, usableOmenIds } from '../../domain';
import type { ParsedItemResult } from '../../parser/common/types';
import type { AppInfo, AppSettings, OverlayApi } from '../../preload/api-types';
import { buildDebugReport } from '../view-model/debug-report';
import { defaultPoolSource, poolBranches, type ModifierRow } from '../view-model/rows';
import { INITIAL_WORKSPACE, workspaceReducer } from '../view-model/workspace';
import { CraftControls } from './CraftControls';
import { DiagnosticList } from './Diagnostics';
import { ItemPreview } from './ItemPreview';
import { useGameTerms } from './game-terms';
import { ModifierPanel } from './ModifierPanel';
import { ResultSummary } from './Result';

export type ParseFn = (raw: string, clipboardLocale: string) => ParsedItemResult;

/** A failed IPC call keeps the current view instead of an unhandled rejection (spec 017 B4). */
const logIpcError = (error: unknown) => console.error('overlay IPC call failed', error);

interface Props {
  api: OverlayApi;
  pack: DataPack;
  parse: ParseFn;
  settings: AppSettings;
  appInfo: AppInfo | null;
  initialText?: string;
}

export function Workspace({ api, pack, parse, settings, appInfo, initialText = '' }: Props) {
  const { t } = useTranslation();
  const game = useGameTerms();
  const [state, dispatch] = useReducer(workspaceReducer, { ...INITIAL_WORKSPACE, rawText: initialText });
  const [includeRaw, setIncludeRaw] = useState(false);
  const [selected, setSelected] = useState<ModifierRow | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let pushed = false;
    const off = api.onClipboardSnapshot((snap) => {
      pushed = true;
      dispatch({ type: 'clipboard', text: snap.text });
    });
    // A snapshot pushed before this component subscribed is served from main's cache (spec 009).
    void api
      .getLastSnapshot()
      .then((snap) => {
        if (snap && !pushed) dispatch({ type: 'clipboard', text: snap.text });
      })
      .catch(logIpcError);
    return off;
  }, [api]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') api.hideOverlay();
      // Ctrl+V in the overlay: explicit user request to read the clipboard (SoT §3.1).
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && !(e.target instanceof HTMLInputElement)) {
        void api.readClipboard().then((s) => dispatch({ type: 'clipboard', text: s.text })).catch(logIpcError);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api]);

  const readClipboard = () => void api.readClipboard().then((s) => dispatch({ type: 'clipboard', text: s.text })).catch(logIpcError);

  const result = useMemo(() => parse(state.rawText, settings.localization.clipboardLocale), [parse, state.rawText, settings.localization.clipboardLocale]);
  const item = result.ok ? result.item : null;
  const targetGroup = item ? pack.itemClassTargets.find((c) => c.itemClassId === item.itemClassId)?.target : undefined;

  useEffect(() => {
    if (!item) return;
    const bones = new Set(boneOptions(item, pack, { includeLegacy: true }).filter((o) => o.selectable).map((o) => o.boneId));
    const omens = usableOmenIds(item, state.boneId, pack);
    const fallbackBone = defaultBoneId(item, pack);
    dispatch({ type: 'keepSelectable', boneIds: bones, omenIds: omens, ...(targetGroup ? { targetGroup } : {}), ...(fallbackBone ? { defaultBoneId: fallbackBone } : {}) });
  }, [item, pack, targetGroup, state.boneId]);

  const slots = useMemo(() => (item ? affixSlots(item, pack) : null), [item, pack]);
  // Each new item starts with the side filter matching its free slots (spec 014).
  useEffect(() => {
    if (slots) dispatch({ type: 'itemDefaults', sides: defaultSides(slots) });
  }, [slots]);

  // A new item or another Bone/Omen choice invalidates the previewed modifier.
  useEffect(() => setSelected(null), [item, state.boneId, state.omenIds]);

  const evaluation = useMemo(
    () => (item && state.boneId ? evaluateDesecration({ item, parserConfidence: result.confidence, currency: state.boneId, activeOmens: state.omenIds, data: pack }) : null),
    [item, result.confidence, state.boneId, state.omenIds, pack],
  );
  const fallbackSource = evaluation ? defaultPoolSource(evaluation) : null;
  const source =
    evaluation && state.poolSource && (state.poolSource === 'base' ? evaluation.basePool.sides.length > 0 : evaluation.branches.length > 0) ? state.poolSource : fallbackSource;
  const pool = useMemo(() => (evaluation && source ? poolBranches(evaluation, source) : null), [evaluation, source]);
  const branchId = state.selectedBranchId ?? evaluation?.branches[0]?.id ?? 'union';
  const bothSources = evaluation !== null && evaluation.basePool.sides.length > 0 && evaluation.branches.length > 0;

  const copyDebugReport = () => {
    const text = buildDebugReport({ appInfo, parse: result, evaluation, boneId: state.boneId, omenIds: state.omenIds, includeRawText: includeRaw, rawText: state.rawText, gameTermDiagnostics: game.diagnostics() });
    void api.writeDebugReport(text).then(() => setCopied(true)).catch(logIpcError);
  };
  // The "copied" note clears itself so a later copy is confirmed again (spec 017 B7).
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 3000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <main className="workspace">
      {pack.manifest.stale ? <p className="banner warning">{t('workspace:dataStale')}</p> : null}
      {!item ? (
        <section className="empty-state">
          <p className="hint">{t('workspace:copyItemHint', { hotkey: settings.hotkey.replace('CommandOrControl', 'Ctrl') })}</p>
          <DiagnosticList items={result.diagnostics.filter((d) => d.severity === 'error')} />
          <button type="button" className="primary" onClick={readClipboard}>
            {t('common:retry')}
          </button>
        </section>
      ) : (
        <div className="columns">
          <aside className="col col-craft">
            <CraftControls
              item={item}
              pack={pack}
              boneId={state.boneId}
              omenIds={state.omenIds}
              showLegacy={settings.showLegacyCurrencies}
              onBone={(boneId) => dispatch({ type: 'bone', boneId, ...(targetGroup ? { targetGroup } : {}) })}
              onToggleOmen={(omenId) => dispatch({ type: 'toggleOmen', omenId })}
            />
          </aside>
          <section className="col col-pool">
            {evaluation ? (
              <>
                {bothSources ? (
                  <div className="source-switch" role="tablist" aria-label={t('workspace:poolSource')}>
                    {(['base', 'item'] as const).map((s) => (
                      <button key={s} type="button" role="tab" className="tab" aria-selected={source === s} onClick={() => dispatch({ type: 'poolSource', source: s })}>
                        {t(s === 'base' ? 'workspace:sourceBase' : 'workspace:sourceItem')}
                      </button>
                    ))}
                  </div>
                ) : null}
                <ResultSummary evaluation={evaluation} source={source} />
                {source && pool ? (
                  <ModifierPanel
                    pool={pool}
                    source={source}
                    branchId={branchId}
                    view={state.view}
                    filters={state.filters}
                    selectedId={selected?.modifierId ?? null}
                    openSideOnly={slots && defaultSides(slots).length === 1 ? defaultSides(slots)[0] : undefined}
                    onSelect={(row) => setSelected((cur) => (cur?.modifierId === row.modifierId ? null : row))}
                    onBranch={(id) => dispatch({ type: 'branch', branchId: id })}
                    onView={(view) => dispatch({ type: 'view', view })}
                    onFilters={(patch) => dispatch({ type: 'filters', patch })}
                  />
                ) : null}
              </>
            ) : (
              <p className="choose-hint">{t('workspace:chooseCurrency')}</p>
            )}
          </section>
          <aside className="col col-item">
            <ItemPreview
              item={item}
              slots={slots ?? affixSlots(item, pack)}
              selected={selected}
              onReread={readClipboard}
              badges={
                result.confidence !== 'full' || settings.showDataVersion ? (
                  <p className="badges">
                    {/* SoT §16.4 (0.2.7): the parser badge appears only when parsing was not full. */}
                    {result.confidence !== 'full' ? <span className={`badge confidence-${result.confidence}`}>{t(`common:confidence.${result.confidence}`)}</span> : null}
                    {settings.showDataVersion ? (
                      <span className="badge">{t('about:dataVersion', { gameVersion: pack.manifest.targetGameVersion, repoeVersion: pack.manifest.repoeObservedVersion, generatedAt: pack.manifest.generatedAt.slice(0, 10) })}</span>
                    ) : null}
                  </p>
                ) : null
              }
            />
          </aside>
        </div>
      )}
      <footer className="footer">
        <span className="notice">{t('about:gggNotice')}</span>
        <details className="debug">
          <summary>{t('common:copyDebugReport')}</summary>
          <label className="toggle subtle">
            <input type="checkbox" checked={includeRaw} onChange={(e) => setIncludeRaw(e.target.checked)} />
            {t('common:includeRawText')}
          </label>
          <button type="button" onClick={copyDebugReport}>
            {t('common:copyDebugReport')}
          </button>
          {copied ? <span role="status">{t('common:debugReportCopied')}</span> : null}
        </details>
      </footer>
    </main>
  );
}
