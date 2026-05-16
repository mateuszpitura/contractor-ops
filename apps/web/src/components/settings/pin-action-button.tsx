'use client';

import { Pin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useSettingsTabPins } from '@/hooks/use-settings-tab-pins';
import type { SettingsTabKey } from '@/lib/settings-tabs';
import { getSettingsTab } from '@/lib/settings-tabs';
import { cn } from '@/lib/utils';

export interface PinActionButtonProps {
  tabKey: SettingsTabKey;
  className?: string;
}

/**
 * Page-header variant of the pin toggle. Used on dedicated settings sub-pages
 * (`/settings/members`, `/settings/workflow-roles`) where there is no
 * `<TabsTrigger>` to attach the lightweight `<PinTabButton>` to.
 *
 * Renders as a small outline-style button with the localised tab label so the
 * user understands what they're pinning. State + optimistic toggle come from
 * the shared `useSettingsTabPins` hook so this view stays in sync with the
 * sidebar and the `/settings` tab list.
 */
export function PinActionButton({ tabKey, className }: PinActionButtonProps) {
  const t = useTranslations('Settings');
  const tPin = useTranslations('Settings.pin');
  const { isPinned, toggle, isPending, isLoaded } = useSettingsTabPins();

  const handleClick = useCallback(() => toggle(tabKey), [toggle, tabKey]);

  const tab = getSettingsTab(tabKey);
  const tabLabel = t(`tabs.${tab.i18nKey}`);
  const pinned = isPinned(tabKey);
  const label = pinned ? tPin('unpin', { tab: tabLabel }) : tPin('pin', { tab: tabLabel });

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={!isLoaded || isPending}
      aria-pressed={pinned}
      title={label}
      className={cn('gap-1.5 transition-colors', className)}>
      <Pin
        className={cn(
          'me-2 h-4 w-4 text-muted-foreground transition-transform',
          pinned ? 'rotate-45' : '',
        )}
        aria-hidden="true"
      />
      <span>{label}</span>
    </Button>
  );
}
