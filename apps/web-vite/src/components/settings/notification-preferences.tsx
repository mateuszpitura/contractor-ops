import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  FileWarning,
  Loader2,
  Save,
  UserCheck,
} from 'lucide-react';
import { Controller } from 'react-hook-form';
import { tDynLoose } from '../../i18n/typed-keys';
import { useTranslations } from '../../i18n/useTranslations.js';
import type { useNotificationPreferences } from './hooks/use-notification-preferences.js';
import { NOTIFICATION_TYPES } from './hooks/use-notification-preferences.js';

export type NotificationPreferencesProps = ReturnType<typeof useNotificationPreferences>;

type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const EVENT_CONFIG: Record<
  NotificationType,
  {
    icon: typeof ClipboardCheck;
    labelKey: string;
    iconClass: string;
    bgClass: string;
  }
> = {
  APPROVAL_REQUEST: {
    icon: ClipboardCheck,
    labelKey: 'eventApprovalRequest',
    iconClass: 'text-primary',
    bgClass: 'bg-primary/10',
  },
  APPROVAL_DECISION: {
    icon: CheckCircle2,
    labelKey: 'eventApprovalDecision',
    iconClass: 'text-emerald-500',
    bgClass: 'bg-emerald-500/10',
  },
  TASK_ASSIGNED: {
    icon: UserCheck,
    labelKey: 'eventTaskAssigned',
    iconClass: 'text-blue-500',
    bgClass: 'bg-blue-500/10',
  },
  TASK_OVERDUE: {
    icon: Clock,
    labelKey: 'eventTaskOverdue',
    iconClass: 'text-amber-500',
    bgClass: 'bg-amber-500/10',
  },
  CONTRACT_EXPIRING: {
    icon: FileWarning,
    labelKey: 'eventContractExpiring',
    iconClass: 'text-amber-500',
    bgClass: 'bg-amber-500/10',
  },
  INVOICE_RECEIVED: {
    icon: FileText,
    labelKey: 'eventInvoiceReceived',
    iconClass: 'text-primary',
    bgClass: 'bg-primary/10',
  },
};

export function NotificationPreferencesSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-1 h-4 w-96" />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-auto">
                <Skeleton className="h-4 w-24" />
              </TableHead>
              <TableHead className="w-20 text-center">
                <Skeleton className="mx-auto h-4 w-12" />
              </TableHead>
              <TableHead className="w-20 text-center">
                <Skeleton className="mx-auto h-4 w-12" />
              </TableHead>
              <TableHead className="w-20 text-center">
                <Skeleton className="mx-auto h-4 w-12" />
              </TableHead>
              <TableHead className="w-20 text-center">
                <Skeleton className="mx-auto h-4 w-12" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <TableRow key={`pref-${i}`}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-8 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Skeleton className="mx-auto h-5 w-10" />
                </TableCell>
                <TableCell className="text-center">
                  <Skeleton className="mx-auto h-5 w-10" />
                </TableCell>
                <TableCell className="text-center">
                  <Skeleton className="mx-auto h-5 w-10" />
                </TableCell>
                <TableCell className="text-center">
                  <Skeleton className="mx-auto h-5 w-10" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter>
        <Skeleton className="h-9 w-40" />
      </CardFooter>
    </Card>
  );
}

export function NotificationPreferences({
  t,
  form,
  isSlackConnected,
  isTeamsConnected,
  onSubmit,
  isSavePending,
}: NotificationPreferencesProps) {
  const tAria = useTranslations('Common.aria');
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>{t('notifications.heading')}</CardTitle>
          <CardDescription>{t('notifications.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-auto">{t('notifications.columnEvent')}</TableHead>
                <TableHead className="w-20 text-center">{t('notifications.columnInApp')}</TableHead>
                <TableHead className="w-20 text-center">{t('notifications.columnEmail')}</TableHead>
                <TableHead className="w-20 text-center">{t('notifications.columnSlack')}</TableHead>
                <TableHead className="w-20 text-center">{t('notifications.columnTeams')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {NOTIFICATION_TYPES.map((type, index) => {
                const config = EVENT_CONFIG[type];
                const Icon = config.icon;

                return (
                  <TableRow key={type}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex size-8 items-center justify-center rounded-full ${config.bgClass}`}>
                          <Icon className={`size-4 ${config.iconClass}`} />
                        </div>
                        <span className="text-sm font-medium">
                          {tDynLoose(t, 'notifications', config.labelKey)}
                        </span>
                      </div>
                    </TableCell>

                    {/* In-app: always on, disabled */}
                    <TableCell className="text-center">
                      <Tooltip>
                        <TooltipTrigger render={<div className="inline-flex" />}>
                          <Switch checked disabled aria-label={tAria('inApp')} />
                        </TooltipTrigger>
                        <TooltipContent>{t('notifications.inAppTooltip')}</TooltipContent>
                      </Tooltip>
                    </TableCell>

                    {/* Email */}
                    <TableCell className="text-center">
                      <Controller
                        control={form.control}
                        name={`preferences.${index}.channelEmail`}
                        // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
                        render={({ field }) => (
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            aria-label={tAria('email')}
                          />
                        )}
                      />
                    </TableCell>

                    {/* Slack */}
                    <TableCell className="text-center">
                      {isSlackConnected ? (
                        <Controller
                          control={form.control}
                          name={`preferences.${index}.channelSlack`}
                          // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
                          render={({ field }) => (
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              aria-label={tAria('slack')}
                            />
                          )}
                        />
                      ) : (
                        <Tooltip>
                          <TooltipTrigger render={<div className="inline-flex" />}>
                            <Switch checked={false} disabled aria-label={tAria('slack')} />
                          </TooltipTrigger>
                          <TooltipContent>{t('notifications.slackDisabledTooltip')}</TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>

                    {/* Teams */}
                    <TableCell className="text-center">
                      {isTeamsConnected ? (
                        <Controller
                          control={form.control}
                          name={`preferences.${index}.channelTeams`}
                          // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
                          render={({ field }) => (
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              aria-label={tAria('teams')}
                            />
                          )}
                        />
                      ) : (
                        <Tooltip>
                          <TooltipTrigger render={<div className="inline-flex" />}>
                            <Switch checked={false} disabled aria-label={tAria('teams')} />
                          </TooltipTrigger>
                          <TooltipContent>{t('notifications.teamsDisabledTooltip')}</TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={!form.formState.isDirty || isSavePending}>
            {isSavePending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {t('notifications.savePreferences')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
