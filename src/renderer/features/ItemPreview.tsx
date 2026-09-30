import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { AffixSlots, SideSlots } from '../../domain';
import type { ParsedAffix, ParsedItem } from '../../parser/common/types';
import type { ModifierRow } from '../view-model/rows';
import { useGameTerms } from './game-terms';

interface Props {
  item: ParsedItem;
  slots: AffixSlots;
  /** Modifier picked in the list, shown on the item as a preview (SoT §16.4, 0.2.9). */
  selected: ModifierRow | null;
  badges: ReactNode;
  onReread: () => void;
}

/** Free slots of one side as pips: filled = used, hollow = free. */
function Pips({ side, s }: { side: 'prefix' | 'suffix'; s: SideSlots }) {
  return (
    <span className={`pips ${side}`} aria-hidden="true">
      {Array.from({ length: s.max }, (_, i) => (
        <span key={i} className={i < s.used ? 'pip used' : 'pip'} />
      ))}
    </span>
  );
}

function AffixLines({ affixes, side }: { affixes: readonly ParsedAffix[]; side: 'prefix' | 'suffix' | 'unknown' }) {
  return (
    <>
      {affixes.map((a, i) => (
        <li key={`${side}-${i}`} className={`mod side-${side}${a.fractured ? ' fractured' : ''}${a.desecrated ? ' desecrated' : ''}`}>
          {a.rawLines.join(' · ')}
        </li>
      ))}
    </>
  );
}

// Right column: the copied item as in the game tooltip, plus the picked modifier as a preview.
export function ItemPreview({ item, slots, selected, badges, onReread }: Props) {
  const { t } = useTranslation();
  const game = useGameTerms();
  const baseName = item.baseItemId ? game.baseItemName(item.baseItemId).text : item.baseTypeText;
  const preview = (side: 'prefix' | 'suffix') =>
    selected && selected.side === side ? (
      <li className={`mod preview side-${side}`}>
        <span className="preview-label">{t('workspace:previewDesecrated')}</span>
        {selected.text}
      </li>
    ) : null;

  return (
    <section className="item-preview" aria-label={t('workspace:previewTitle')}>
      <header className={`tooltip-head rarity-${item.rarity}`}>
        <div className="tooltip-title">
          <h1>{item.itemName ?? baseName}</h1>
          <button type="button" className="icon" aria-label={t('workspace:readClipboard')} title={t('workspace:readClipboard')} onClick={onReread}>
            ↻
          </button>
        </div>
        {item.itemName ? <p className="tooltip-base">{baseName}</p> : null}
      </header>
      <p className="tooltip-meta">
        {item.itemClassId ? <span>{game.itemClassName(item.itemClassId).text}</span> : null}
        <span className="ilvl">{t('workspace:itemLevel', { level: item.itemLevel })}</span>
      </p>

      {slots.state === 'determined' ? (
        <div className="slots" title={slots.basis === 'recognized_only' ? t('workspace:slotsRecognizedOnly') : undefined}>
          <span className="slots-label">
            {t('workspace:freeSlots')}
            {slots.basis === 'recognized_only' ? <span className="slots-mark" aria-label={t('workspace:slotsRecognizedOnly')}> *</span> : null}
          </span>
          <span className="slot prefix">
            <Pips side="prefix" s={slots.prefix} />
            {t('workspace:freePrefixes', { count: slots.prefix.free })}
          </span>
          <span className="slot suffix">
            <Pips side="suffix" s={slots.suffix} />
            {t('workspace:freeSuffixes', { count: slots.suffix.free })}
          </span>
        </div>
      ) : (
        <p className="slots-note">{t('workspace:slotsUndetermined')}</p>
      )}

      <ul className="tooltip-mods">
        <AffixLines affixes={item.prefixes} side="prefix" />
        {preview('prefix')}
        <AffixLines affixes={item.suffixes} side="suffix" />
        {preview('suffix')}
        <AffixLines affixes={item.unknownAffixes} side="unknown" />
      </ul>
      {selected ? null : <p className="hint">{t('workspace:previewPick')}</p>}
      {badges}
    </section>
  );
}
