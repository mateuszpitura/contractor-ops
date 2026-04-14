// ---------------------------------------------------------------------------
// Phase 60 · Plan 04 · CLASS-10 — RefreshDashboardButton
// ---------------------------------------------------------------------------
//
// Invalidates every classificationDashboard.* React-Query cache so all tiles
// refetch. Exposes an aria-live='polite' region that announces completion so
// screen-reader users receive feedback for the otherwise-silent action.
//
// UI-SPEC: spinner for ≥500ms to avoid jank.

'use client';

import { RotateCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/trpc/init';

const MIN_SPINNER_MS = 500;

export function RefreshDashboardButton() {
  const t = useTranslations('Classification.polish.dashboard');
  const utils = trpc.useUtils();
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState<string>('');

  const onClick = useCallback(async () => {
    setBusy(true);
    setAnnouncement('');
    const start = Date.now();
    try {
      await utils.classificationDashboard.invalidate();
    } finally {
      const elapsed = Date.now() - start;
      if (elapsed < MIN_SPINNER_MS) {
        await new Promise(resolve => setTimeout(resolve, MIN_SPINNER_MS - elapsed));
      }
      setBusy(false);
      setAnnouncement(t('refreshAnnouncement'));
    }
  }, [utils.classificationDashboard, t]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={onClick}
        aria-label={t('refreshButton')}
        data-testid="refresh-dashboard-button">
        <RotateCw
          aria-hidden="true"
          className={busy ? 'size-4 animate-spin' : 'size-4'}
        />
        <span>{busy ? t('refreshingLabel') : t('refreshButton')}</span>
      </Button>
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="refresh-announcement">
        {announcement}
      </span>
    </>
  );
}
