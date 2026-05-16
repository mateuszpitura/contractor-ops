'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/trpc/init';

/**
 * "Out of office" section in user settings.
 * Wires user.setOutOfOffice / user.clearOutOfOffice.
 */
export function OutOfOfficeSection() {
  const t = useTranslations('Settings.outOfOffice');
  const queryClient = useQueryClient();

  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');
  const [reason, setReason] = useState('');

  const setOoo = useMutation(
    trpc.user.setOutOfOffice.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.saved'));
        queryClient.invalidateQueries(trpc.user.pathFilter());
        setFrom('');
        setUntil('');
        setReason('');
      },
      onError: err => toast.error(err.message),
    }),
  );
  const clearOoo = useMutation(
    trpc.user.clearOutOfOffice.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.cleared'));
        queryClient.invalidateQueries(trpc.user.pathFilter());
      },
      onError: err => toast.error(err.message),
    }),
  );

  const isPending = setOoo.isPending || clearOoo.isPending;
  const isValid = !!from && !!until && new Date(until) >= new Date(from);

  function handleSave() {
    if (!isValid) return;
    setOoo.mutate({
      from: new Date(from).toISOString(),
      until: new Date(until).toISOString(),
      reason: reason || undefined,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ooo-from">{t('from')}</Label>
            <Input
              id="ooo-from"
              type="datetime-local"
              value={from}
              onChange={e => setFrom(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div>
            <Label htmlFor="ooo-until">{t('until')}</Label>
            <Input
              id="ooo-until"
              type="datetime-local"
              value={until}
              onChange={e => setUntil(e.target.value)}
              disabled={isPending}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="ooo-reason">{t('reason')}</Label>
          <Textarea
            id="ooo-reason"
            rows={2}
            value={reason}
            onChange={e => setReason(e.target.value)}
            disabled={isPending}
            maxLength={500}
            placeholder={t('reasonPlaceholder')}
          />
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline" onClick={() => clearOoo.mutate()} disabled={isPending}>
          {clearOoo.isPending && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
          {t('clearCta')}
        </Button>
        <Button onClick={handleSave} disabled={!isValid || isPending}>
          {setOoo.isPending && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
          {t('saveCta')}
        </Button>
      </CardFooter>
    </Card>
  );
}
