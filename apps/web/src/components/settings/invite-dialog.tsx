'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/trpc/init';

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum([
    'admin',
    'finance_admin',
    'ops_manager',
    'team_manager',
    'legal_compliance_viewer',
    'it_admin',
    'external_accountant',
    'readonly',
  ]),
});

type InviteValues = z.infer<typeof inviteSchema>;

const roleKeys = [
  'admin',
  'finance_admin',
  'ops_manager',
  'team_manager',
  'legal_compliance_viewer',
  'it_admin',
  'external_accountant',
  'readonly',
] as const;

export function InviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('Users.inviteDialog');
  const tr = useTranslations('Users.roles');
  const tToast = useTranslations('Settings.toast');
  const queryClient = useQueryClient();

  const inviteMutation = useMutation(
    trpc.user.invite.mutationOptions({
      onSuccess: () => {
        toast.success(t('successToast'));
        queryClient.invalidateQueries({ queryKey: trpc.user.list.queryKey() });
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        const message =
          typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: unknown }).message ?? '')
            : '';
        toast.error(message || tToast('inviteFailed'));
      },
    }),
  );

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'readonly' },
  });

  useEffect(() => {
    if (!open) reset({ email: '', role: 'readonly' });
  }, [open, reset]);

  const roleItems = roleKeys.map(role => ({
    value: role,
    label: tr(role),
  }));

  const onSubmit = (values: InviteValues) => {
    inviteMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('body', { orgName: '' })}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email" className="text-[13px]">
              {t('emailLabel')}
            </Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="email"
              disabled={inviteMutation.isPending}
              {...register('email')}
            />
            {!!errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role" className="text-[13px]">
              {t('roleLabel')}
            </Label>
            <Select
              value={watch('role')}
              onValueChange={value => setValue('role', value as InviteValues['role'])}
              disabled={inviteMutation.isPending}
              items={roleItems}>
              <SelectTrigger id="invite-role">
                <SelectValue placeholder={t('rolePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {roleItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter showCloseButton>
            <Button type="submit" disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t('sending')}
                </>
              ) : (
                t('cta')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
