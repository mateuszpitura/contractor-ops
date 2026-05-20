'use client';

import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { trpc } from '@/trpc/init';

interface ReverseChargeBannerProps {
  invoiceId: string;
  isReverseCharge: boolean;
  onToggle?: (newValue: boolean) => void;
}

export function ReverseChargeBanner({
  invoiceId,
  isReverseCharge,
  onToggle,
}: ReverseChargeBannerProps) {
  const t = useTranslations('Invoices.reverseCharge');
  const queryClient = useQueryClient();
  const toggleMutation = useMutation(
    trpc.invoice.toggleReverseCharge.mutationOptions({
      onSuccess: (_: unknown, vars: { isReverseCharge: boolean }) => {
        toast.success(vars.isReverseCharge ? t('applied') : t('removedToast'));
        onToggle?.(vars.isReverseCharge);
        queryClient.invalidateQueries(trpc.invoice.pathFilter());
      },

      onError: err => toast.error(err.message),
    }),
  );

  if (!isReverseCharge) return null;

  return (
    <Alert className="border-info/20 bg-info/5">
      <Info className="h-4 w-4 text-info" />
      <AlertTitle className="text-sm font-medium">{t('applied')}</AlertTitle>
      <AlertDescription className="text-sm text-muted-foreground">
        {t('description')}
      </AlertDescription>
      <div className="mt-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="sm" className="h-7 text-xs" />}>
            {t('override')} <ChevronDown className="ms-1 h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              disabled={toggleMutation.isPending}
              onClick={() =>
                toggleMutation.mutate({
                  invoiceId,
                  isReverseCharge: false,
                })
              }>
              {t('remove')}
            </DropdownMenuItem>
            <DropdownMenuItem disabled>{t('keep')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Alert>
  );
}
