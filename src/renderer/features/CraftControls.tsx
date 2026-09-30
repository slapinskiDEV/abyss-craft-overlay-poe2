import { useTranslation } from 'react-i18next';
import type { DataPack } from '../../data/normalized/types';
import { boneOptions, omenOptions, usableOmenIds } from '../../domain';
import { diagnosticParams } from '../../i18n/format-diagnostic';
import type { ParsedItem } from '../../parser/common/types';
import { useGameTerms } from './game-terms';

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
  const { t } = useTranslation();
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
                title={reasonText(o.reasons)}
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
                        title={reasonText(o.reasons)}
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
    </section>
  );
}
