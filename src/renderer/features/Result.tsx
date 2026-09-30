import { useTranslation } from 'react-i18next';
import type { DesecrationEvaluation } from '../../domain';
import type { PoolSource } from '../view-model/rows';
import { useGameTerms } from './game-terms';
import { DiagnosticList } from './Diagnostics';

interface Props {
  evaluation: DesecrationEvaluation;
  /** Which list is shown below (spec 009); null when no list may be shown. */
  source: PoolSource | null;
}

export function ResultSummary({ evaluation, source }: Props) {
  const { t } = useTranslation();
  const game = useGameTerms();
  const blocking = evaluation.reasons.filter((r) => r.severity !== 'info');
  const info = evaluation.reasons.filter((r) => r.severity === 'info');
  const baseWarnings = source === 'base' ? evaluation.basePool.reasons.filter((r) => r.severity !== 'info') : [];
  // Without any list the reasons are the answer, so they are shown open.
  const reasonsOpen = source === null;
  // SoT §14.7 (0.2.7): an `unknown` exact check whose only effect is that the base pool is shown is
  // not displayed; the base pool's own note says it is not final.
  const showExact = !(source === 'base' && evaluation.status === 'unknown');
  return (
    <section className={`result status-${evaluation.status}`} aria-live="polite">
      {showExact ? (
        <div className="status-line">
          <span className="status-label">{t('workspace:exactCheck')}</span>
          <span className="status" data-status={evaluation.status}>
            {t(`common:status.${evaluation.status}`)}
          </span>
        </div>
      ) : null}
      {baseWarnings.length > 0 ? <DiagnosticList items={baseWarnings} /> : null}
      {showExact ? (
        <details className="reasons" open={reasonsOpen}>
          <summary>{t('workspace:details')}</summary>
          {evaluation.status === 'unknown' ? <p className="unknown-note">{t('workspace:unknownInteraction')}</p> : null}
          <DiagnosticList items={blocking} />
          <DiagnosticList items={[...info, ...evaluation.mechanicNotes]} className="diagnostics info" />
        </details>
      ) : null}
      {evaluation.reveal.optionCount > 0 ? (
        <p className="reveal">
          {t('workspace:revealOptions', { count: evaluation.reveal.optionCount })}
          {evaluation.reveal.rerollsAvailable > 0 ? ` · ${t('workspace:rerollAvailable', { count: evaluation.reveal.rerollsAvailable })}` : ''}
        </p>
      ) : null}
      {evaluation.recoveryHints.map((h) => (
        <p key={h.omenId} className="recovery-hint">
          {t('workspace:recoveryHint', { omenName: game.omenName(h.omenId).text, currencyName: game.currencyName(h.currencyId).text })}
        </p>
      ))}
      {evaluation.putrefaction && evaluation.branches.length > 0 ? (
        <div className="putrefaction">
          <strong>{t('workspace:putrefactionTitle')}</strong>
          <p>{t('workspace:putrefactionMax', { count: evaluation.putrefaction.maxUnrevealed })}</p>
          <p>{t('workspace:putrefactionFractured', { count: evaluation.putrefaction.fracturedKept })}</p>
          <p>{t('workspace:putrefactionCorrupts')}</p>
        </div>
      ) : null}
    </section>
  );
}
