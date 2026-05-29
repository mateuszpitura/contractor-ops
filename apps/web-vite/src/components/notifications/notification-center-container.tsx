import { AtelierEmptyState, NotificationsIllustration } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import { Tabs, TabsList, TabsTrigger } from '@contractor-ops/ui/components/shadcn/tabs';
import { CheckCheck } from 'lucide-react';
import { useCallback, useId } from 'react';
import { tDyn } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { AnimateIn } from '../shared/animate-in.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import {
  NOTIFICATION_FILTER_KEYS,
  useNotificationCenter,
} from './hooks/use-notification-center.js';
import { NotificationCenterSkeleton } from './notification-center-skeleton.js';
import type { NotificationData } from './notification-item.js';
import { NotificationItem } from './notification-item.js';

interface NotificationRowProps {
  notification: NotificationData;
  onItemClick: (n: NotificationData) => void;
  disabled: boolean;
}

function NotificationRow({ notification, onItemClick, disabled }: NotificationRowProps) {
  const handleClick = useCallback(() => onItemClick(notification), [onItemClick, notification]);
  return (
    <div className="border-b last:border-b-0">
      <NotificationItem notification={notification} onClick={handleClick} disabled={disabled} />
    </div>
  );
}

export function NotificationCenterContainer() {
  const t = useTranslations('Notifications');
  const te = useTranslations('EmptyStates');
  const id = useId();
  const center = useNotificationCenter();

  return (
    <div className="mx-auto max-w-3xl space-y-section-gap">
      <AnimateIn delay={0}>
        <WorkbenchPageHeader
          title={t('title')}
          description={t('pageDescription')}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={center.handleMarkAllRead}
              disabled={center.unreadCount === 0 || center.isMarkingAllRead}>
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {t('markAllRead')}
            </Button>
          }
        />
      </AnimateIn>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={center.typeFilter} onValueChange={center.handleFilterChange}>
          <TabsList>
            {NOTIFICATION_FILTER_KEYS.map(key => (
              <TabsTrigger key={key} value={key}>
                {tDyn(t, 'filters', key)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Switch
            id={`${id}-unread-only`}
            checked={center.unreadOnly === 'true'}
            onCheckedChange={center.handleUnreadToggle}
          />
          <Label htmlFor={`${id}-unread-only`} className="text-sm">
            {t('unreadOnly')}
          </Label>
        </div>
      </div>

      {center.isLoading ? (
        <NotificationCenterSkeleton />
      ) : center.isEmpty ? (
        <AtelierEmptyState
          illustration={NotificationsIllustration}
          heading={te('notifications.heading')}
          body={te('notifications.body')}
          renderAction={renderEmptyStateAction}
        />
      ) : (
        <>
          <div className="flex flex-col rounded-lg border">
            {center.notifications.map(n => (
              <NotificationRow
                key={n.id}
                notification={n}
                onItemClick={center.handleItemClick}
                disabled={center.isMarkingRead}
              />
            ))}
          </div>

          {center.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={center.handlePreviousPage}
                disabled={center.page <= 1}>
                {t('pagination.previous')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('pagination.pageOf', { page: center.page, totalPages: center.totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={center.handleNextPage}
                disabled={center.page >= center.totalPages}>
                {t('pagination.next')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
