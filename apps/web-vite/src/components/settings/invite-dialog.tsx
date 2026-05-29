import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogFormLayoutClassName,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Loader2, UserPlus } from 'lucide-react';
import { useCallback, useId } from 'react';

import type { InviteValues, useInviteDialog } from './hooks/use-invite-dialog.js';

export type InviteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & ReturnType<typeof useInviteDialog>;

export function InviteDialog({
  open,
  onOpenChange,
  t,
  form,
  roleItems,
  onSubmit,
  isPending,
}: InviteDialogProps) {
  const id = useId();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const handleRoleChange = useCallback(
    (value: InviteValues['role'] | null) => {
      if (value) setValue('role', value);
    },
    [setValue],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-4" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('body', { orgName: '' })}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className={dialogFormLayoutClassName}>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-invite-email`} className="text-[13px]">
                {t('emailLabel')}
              </Label>
              <Input
                id={`${id}-invite-email`}
                type="email"
                autoComplete="email"
                disabled={isPending}
                {...register('email')}
              />
              {!!errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${id}-invite-role`} className="text-[13px]">
                {t('roleLabel')}
              </Label>
              <Select
                value={watch('role')}
                onValueChange={handleRoleChange}
                disabled={isPending}
                items={roleItems}>
                <SelectTrigger id={`${id}-invite-role`} className="w-full">
                  <SelectValue placeholder={t('rolePlaceholder')} />
                </SelectTrigger>
                <SelectContent side="bottom" className="max-h-64 overflow-y-auto">
                  {roleItems.map(item => (
                    <SelectItem key={item.value} value={item.value} className="py-2">
                      <div className="flex flex-col">
                        <span>{item.label}</span>
                        <span className="text-xs font-normal text-muted-foreground whitespace-normal">
                          {item.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </DialogBody>

          <DialogFooter showCloseButton>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
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
