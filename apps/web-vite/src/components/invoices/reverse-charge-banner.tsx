/**
 * Reverse-charge invoice banner.
 */

import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import { ChevronDown, Info } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';

interface ReverseChargeBannerProps {
  isPending?: boolean;
  onRemove: () => void;
}

export function ReverseChargeBanner({ isPending = false, onRemove }: ReverseChargeBannerProps) {
  const t = useTranslations('Invoices.reverseCharge');

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
            <DropdownMenuItem disabled={isPending} onClick={onRemove}>
              {t('remove')}
            </DropdownMenuItem>
            <DropdownMenuItem disabled>{t('keep')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Alert>
  );
}
