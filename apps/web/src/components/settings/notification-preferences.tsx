'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { trpc } from '@/trpc/init';
import { tDyn } from '@/i18n/typed-keys';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOTIFICATION_TYPES = [
  'APPROVAL_REQUEST',
  'APPROVAL_DECISION',
  'TASK_ASSIGNED',
  'TASK_OVERDUE',
  'CONTRACT_EXPIRING',
  'INVOICE_RECEIVED',
] as const;

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

// ---------------------------------------------------------------------------
// Form schema (local mirror per project convention 02-02)
// ---------------------------------------------------------------------------

const preferenceFormSchema = z.object({
  preferences: z.array(
    z.object({
      notificationType: z.string(),
      channelEmail: z.boolean(),
      channelSlack: z.boolean(),
      channelTeams: z.boolean(),
    }),
  ),
});

type PreferenceFormValues = z.infer<typeof preferenceFormSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationPreferences() {
  const t = useTranslations('Settings');
  const tAria = useTranslations('Common.aria');
  const queryClient = useQueryClient();

  const preferencesQuery = useQuery(trpc.notification.getPreferences.queryOptions());
  const slackStatusQuery = useQuery(trpc.integration.getSlackStatus.queryOptions());
  const teamsHealthQuery = useQuery(
    trpc.integration.getHealth.queryOptions({ provider: 'microsoft_teams' }),
  );

  const isSlackConnected = slackStatusQuery.data?.connected === true;
  const isTeamsConnected =
    (teamsHealthQuery.data as { status?: string } | null | undefined)?.status === 'CONNECTED';

  const form = useForm<PreferenceFormValues>({
    resolver: zodResolver(preferenceFormSchema),
    defaultValues: {
      preferences: NOTIFICATION_TYPES.map(type => ({
        notificationType: type,
        channelEmail: true,
        channelSlack: true,
        channelTeams: false,
      })),
    },
  });

  // Populate form when data loads
  useEffect(() => {
    if (preferencesQuery.data) {
      const prefs = preferencesQuery.data;
      form.reset({
        preferences: NOTIFICATION_TYPES.map(type => {
          const pref = prefs.find((p: { notificationType: string }) => p.notificationType === type);
          return {
            notificationType: type,
            channelEmail: pref?.channelEmail ?? true,
            channelSlack: pref?.channelSlack ?? true,
            channelTeams: pref?.channelTeams ?? false,
          };
        }),
      });
    }
  }, [preferencesQuery.data, form]);

  const updateMutation = useMutation(
    trpc.notification.updatePreferences.mutationOptions({
      onSuccess: () => {
        toast.success(t('notifications.preferencesSaved'));
        queryClient.invalidateQueries({
          queryKey: trpc.notification.getPreferences.queryKey(),
        });
      },
      onError: () => {
        toast.error(t('notifications.preferencesSaveFailed'));
      },
    }),
  );

  const onSubmit = (data: PreferenceFormValues) => {
    updateMutation.mutate({ preferences: data.preferences });
  };

  // Loading state
  if (preferencesQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-1 h-4 w-96" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <div key={`pref-${i}`} className="flex items-center gap-4 py-3">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <div className="ms-auto flex gap-8">
                <Skeleton className="h-5 w-10" />
                <Skeleton className="h-5 w-10" />
                <Skeleton className="h-5 w-10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

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
                <TableHead className="w-20 text-center">
                  {t('notifications.columnTeams')}
                </TableHead>
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
                          {tDyn(t, 'notifications', config.labelKey)}
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
                              aria-label={tAria('teams' as Parameters<typeof tAria>[0])}
                            />
                          )}
                        />
                      ) : (
                        <Tooltip>
                          <TooltipTrigger render={<div className="inline-flex" />}>
                            <Switch
                              checked={false}
                              disabled
                              aria-label={tAria('teams' as Parameters<typeof tAria>[0])}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            {t('notifications.teamsDisabledTooltip')}
                          </TooltipContent>
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
          <Button type="submit" disabled={!form.formState.isDirty || updateMutation.isPending}>
            {updateMutation.isPending ? (
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
