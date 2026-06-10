import { invitableMemberRoleValues } from '@contractor-ops/validators/roles';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

const inviteSchema = z.object({
  email: z.email(),
  role: z.enum(invitableMemberRoleValues),
});

export type InviteValues = z.infer<typeof inviteSchema>;

const roleKeys = invitableMemberRoleValues;

interface UseInviteDialogOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function useInviteDialog({ open, onOpenChange }: UseInviteDialogOptions) {
  const trpc = useTRPC();
  const t = useTranslations('Users.inviteDialog');
  const tr = useTranslations('Users.roles');
  const trd = useTranslations('Users.roleDescriptions');
  const tToast = useTranslations('Settings.toast');

  const inviteMutation = useResourceMutation(trpc.user.invite.mutationOptions(), {
    invalidate: [trpc.user.list.queryKey()],
    successMessage: t('successToast'),
    errorMessage: tToast('inviteFailed'),
    onClose: () => onOpenChange(false),
  });

  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'readonly' },
  });

  useEffect(() => {
    if (!open) form.reset({ email: '', role: 'readonly' });
  }, [open, form]);

  const roleItems = roleKeys.map(role => {
    const key = enumKey(role) as Parameters<typeof tr>[0];
    return {
      value: role,
      label: tr(key),
      description: trd(key as Parameters<typeof trd>[0]),
    };
  });

  const onSubmit = (values: InviteValues) => {
    inviteMutation.mutate(values);
  };

  return {
    t,
    form,
    roleItems,
    onSubmit,
    isPending: inviteMutation.isPending,
  } as const;
}
