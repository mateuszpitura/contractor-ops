import { ScrollArea } from '@contractor-ops/ui/components/shadcn/scroll-area';
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@contractor-ops/ui/components/shadcn/sheet';
import type { ReactNode } from 'react';

import { useDirection } from '../../hooks/use-direction.js';

export interface EntitySummarySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Screen-reader-only title while visual title is skeleton chrome. */
  titleVisuallyHidden?: boolean;
  badges?: ReactNode;
  detailsTitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
  sheetClassName?: string;
}

export function EntitySummarySheet({
  open,
  onOpenChange,
  title,
  titleVisuallyHidden = false,
  badges,
  detailsTitle,
  children,
  footer,
  sheetClassName = 'w-[400px] sm:w-[480px]',
}: EntitySummarySheetProps) {
  const direction = useDirection();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent dir={direction} className={`${sheetClassName} p-0`}>
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            <SheetHeader className="space-y-3">
              <SheetTitle
                className={
                  titleVisuallyHidden ? 'sr-only' : 'text-[20px] font-semibold leading-[1.2]'
                }>
                {title}
              </SheetTitle>
              {badges == null ? null : (
                <div className="flex items-center gap-2 flex-wrap">{badges}</div>
              )}
            </SheetHeader>

            {detailsTitle != null || children != null ? (
              <>
                <Separator />
                <div className="space-y-3">
                  {detailsTitle ? (
                    <h3 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">
                      {detailsTitle}
                    </h3>
                  ) : null}
                  {children}
                </div>
              </>
            ) : null}

            {footer == null ? null : (
              <>
                <Separator />
                {footer}
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export function EntityDetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono text-[13px]' : ''}>
        {value ?? <span className="text-muted-foreground">&mdash;</span>}
      </dd>
    </div>
  );
}
