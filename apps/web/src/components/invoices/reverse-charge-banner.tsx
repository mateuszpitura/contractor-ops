'use client';

import { useMutation } from '@tanstack/react-query';
import { ChevronDown, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const toggleMutation = useMutation(
    trpc.invoice.toggleReverseCharge.mutationOptions({
      onSuccess: (_: unknown, vars: { isReverseCharge: boolean }) => {
        toast.success(vars.isReverseCharge ? 'Reverse charge applied' : 'Reverse charge removed');
        onToggle?.(vars.isReverseCharge);
      },
    }),
  );

  if (!isReverseCharge) return null;

  return (
    <Alert className="border-info/20 bg-info/5">
      <Info className="h-4 w-4 text-info" />
      <AlertTitle className="text-sm font-medium">Reverse charge applied</AlertTitle>
      <AlertDescription className="text-sm text-muted-foreground">
        Cross-border B2B transaction. VAT to be accounted by the buyer.
      </AlertDescription>
      <div className="mt-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="sm" className="h-7 text-xs" />}>
            Override <ChevronDown className="ms-1 h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() =>
                toggleMutation.mutate({
                  invoiceId,
                  isReverseCharge: false,
                })
              }>
              Remove reverse charge
            </DropdownMenuItem>
            <DropdownMenuItem disabled>Keep reverse charge</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Alert>
  );
}
