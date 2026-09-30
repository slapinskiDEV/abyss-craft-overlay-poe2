import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { DataPack } from '../../data/normalized/types';
import { boneOptions, omenOptions, usableOmenIds } from '../../domain';
import { diagnosticParams } from '../../i18n/format-diagnostic';
import type { ParsedItem } from '../../parser/common/types';
import { useGameTerms } from './game-terms';
import { explainBone, explainOmen, type ExplainPart } from '../view-model/explain';

interface Props {
  item: ParsedItem;
  pack: DataPack;
  boneId: string | null;
  omenIds: readonly string[];
  showLegacy: boolean;
  onBone: (id: string | null) => void;
  onToggleOmen: (id: string) => void;
}

// Every option comes from the data pack via the engine helpers (SoT §0.2 rule 7).
export function CraftControls({ item, pack, boneId, omenIds, showLegacy, onBone, onToggleOmen }: Props) {
  const { t, i18n } = useTranslation();
  const game = useGameTerms();
  // SoT §16.4 (0.2.8): only Bones usable on this item are shown; legacy ones only with the setting.
  const bones = boneOptions(item, pack, { includeLegacy: showLegacy }).filter((o) => o.selectable);
  // SoT §16.4 (0.2.9): Omens that cannot be used on this item are not shown; conflicts between
  // Omens stay visible and disabled with their reason.
  const usable = usableOmenIds(item, boneId, pack);
  const omens = omenOptions(item, boneId, omenIds, pack).filter((o) => usable.has(o.omenId));
  const phases = [...new Set(omens.map((o) => o.phase))];
  const reasonText = (reasons: typeof omens[number]['reasons']) =>
    reasons.map((r) => t(`reasons:${r.code}.detail`, diagnosticParams(r, game))).join('\n');

  // Tooltip (spec 019): the official in-game description; where the UI language differs from the
  // official game-term language, an unofficial summary built from the evidenced rules; then reasons.
  const [tip, setTip] = useState<{ id: string; content: ReactNode; left: number; top: number } | null>(null);
  const explained = i18n.language !== game.locale;
  const partText = (p: ExplainPart): string => {
    const params = p.params ?? {};
    return t(p.key, {
      ...params,
      ...(typeof params.targetKey === 'string' ? { target: t(`workspace:explain.target.${params.targetKey}`) } : {}),
      ...(typeof params.targetKeys === 'string' ? { targets: params.targetKeys.split(',').filter(Boolean).map((k) => t(`workspace:explain.targetOf.${k}`)).join(t('workspace:explain.or')) } : {}),
      ...(typeof params.poolId === 'string' ? { pool: game.poolName(params.poolId).text } : {}),
      ...(p.key.endsWith('.otherworldly') ? { pool: game.poolName('special:otherworldly').text } : {}),
      ...(typeof params.currencyId === 'string' ? { currency: game.currencyName(params.currencyId).text } : {}),
    });
  };
  const tipContent = (id: string, parts: ExplainPart[], reasons: string) => (
    <>
      <span className="tip-official">{game.description(id).text}</span>
      {explained ? <span className="tip-unofficial">{t('workspace:explain.unofficial', { text: parts.map(partText).join(t('workspace:explain.separator')) })}</span> : null}
      {reasons ? <span className="tip-reasons">{reasons}</span> : null}
    </>
  );
  const tipHandlers = (id: string, content: () => ReactNode) => ({
    'aria-describedby': tip?.id === id ? 'craft-tip' : undefined,
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      setTip({ id, content: content(), left: Math.max(4, Math.min(r.left, window.innerWidth - 332)), top: r.bottom + 6 });
    },
    onMouseLeave: () => setTip(null),
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      setTip({ id, content: content(), left: Math.max(4, Math.min(r.left, window.innerWidth - 332)), top: r.bottom + 6 });
    },
    onBlur: () => setTip(null),
  });

  return (
    <section className="controls">
      <div className="control-row">
        <span className="control-label" id="bone-label">
          {t('workspace:bone')}
        </span>
        <div className="chips" role="radiogroup" aria-labelledby="bone-label">
          {bones.map((o) => {
            const legacy = pack.bones.find((b) => b.id === o.boneId)?.releaseState === 'drop_disabled_legacy';
            const checked = boneId === o.boneId;
            return (
              <button
                key={o.boneId}
                type="button"
                role="radio"
                aria-checked={checked}
                className="chip bone"
                disabled={!o.selectable}
                {...tipHandlers(o.boneId, () => {
                  const def = pack.bones.find((b) => b.id === o.boneId);
                  return tipContent(o.boneId, def ? explainBone(def) : [], reasonText(o.reasons));
                })}
                onClick={() => onBone(checked ? null : o.boneId)}
              >
                {game.currencyName(o.boneId).text}
                {legacy ? <span className="chip-badge">{t('workspace:legacyBadge')}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="control-row">
        <span className="control-label">{t('workspace:omens')}</span>
        <div className="omens" role="group" aria-label={t('workspace:omens')}>
          {phases.map((phase) => (
            <div key={phase} className="omen-phase">
              <span className="phase-label">{t(`workspace:omenPhase.${phase}`)}</span>
              <div className="chips">
                {omens
                  .filter((o) => o.phase === phase)
                  .map((o) => {
                    const active = omenIds.includes(o.omenId);
                    return (
                      <button
                        key={o.omenId}
                        type="button"
                        className="chip omen"
                        aria-pressed={active}
                        disabled={!active && !o.selectable}
                        {...tipHandlers(o.omenId, () => {
                          const def = pack.omens.find((x) => x.id === o.omenId);
                          return tipContent(o.omenId, def ? explainOmen(def, pack) : [], reasonText(o.reasons));
                        })}
                        onClick={() => onToggleOmen(o.omenId)}
                      >
                        {game.omenName(o.omenId).text}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
      {tip ? (
        <div id="craft-tip" className="craft-tip" role="tooltip" style={{ left: tip.left, top: tip.top }}>
          {tip.content}
        </div>
      ) : null}
    </section>
  );
}
