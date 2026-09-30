import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OverlayApi, UpdateStatus } from '../../preload/api-types';

/** Title-bar button shown only while a newer app version exists (spec 011). */
export function UpdateButton({ api }: { api: OverlayApi }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<UpdateStatus>({ state: 'none' });
  useEffect(() => {
    // No status (e.g. IPC failed) simply shows no button (spec 017 B4).
    void api.getUpdateStatus().then(setStatus).catch(() => undefined);
    return api.onUpdateStatus(setStatus);
  }, [api]);

  if (status.state === 'none') return null;
  const label =
    status.state === 'available'
      ? t('common:update.available', { version: status.version })
      : status.state === 'downloading'
        ? t('common:update.downloading', { done: status.doneMb, total: status.totalMb })
        : status.state === 'ready'
          ? t('common:update.ready')
          : t('common:update.failed');
  const clickable = status.state === 'available' || status.state === 'failed';
  return (
    <button type="button" className="update-button" disabled={!clickable} onClick={() => api.startUpdate()}>
      {label}
    </button>
  );
}
