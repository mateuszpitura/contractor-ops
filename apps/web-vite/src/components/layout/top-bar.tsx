import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@contractor-ops/ui/components/shadcn/breadcrumb';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';
import { SidebarTrigger } from '@contractor-ops/ui/components/shadcn/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { FilePlus, Search, Upload, UserPlus } from 'lucide-react';
import { Fragment } from 'react';
import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { WizardDialogContainer as ContractorWizardDialogContainer } from '../contractors/contractor-wizard/wizard-dialog-container.js';
import { ContractWizardDialogContainer } from '../contracts/contract-wizard/wizard-dialog-container.js';
import { IntakeUploadDialogContainer } from '../invoices/intake/intake-upload-dialog-container.js';
import { NotificationPopoverContainer } from '../notifications/notification-popover-container.js';
import { CommandPaletteContainer } from '../search/command-palette-container.js';
import type { BreadcrumbSegmentView } from './hooks/use-top-bar-breadcrumbs.js';

interface TopBarProps {
  hasContractors: boolean;
  onOpenContractorWizard: () => void;
  onOpenInvoiceUpload: () => void;
  segments: BreadcrumbSegmentView[];
  contractWizardOpen: boolean;
  onContractWizardOpenChange: (open: boolean) => void;
  onOpenContractWizard: () => void;
  contractorWizardOpen: boolean;
  onContractorWizardOpenChange: (open: boolean) => void;
  invoiceUploadOpen: boolean;
  onInvoiceUploadOpenChange: (open: boolean) => void;
  onOpenSearch: () => void;
}

export function TopBar({
  hasContractors,
  onOpenContractorWizard,
  onOpenInvoiceUpload,
  segments,
  contractWizardOpen,
  onContractWizardOpenChange,
  onOpenContractWizard,
  contractorWizardOpen,
  onContractorWizardOpenChange,
  invoiceUploadOpen,
  onInvoiceUploadOpenChange,
  onOpenSearch,
}: TopBarProps) {
  const t = useTranslations('TopBar');
  const tNav = useTranslations('Navigation');

  return (
    <>
      <header className="glass-subtle sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b-0 px-6">
        <SidebarTrigger className="-ms-1" />
        <Separator orientation="vertical" className="!self-center me-2 h-4" />

        <Breadcrumb className="min-w-0 flex-shrink">
          <BreadcrumbList className="flex-nowrap">
            {segments.length === 0 ? (
              <BreadcrumbItem>
                <BreadcrumbPage>{tNav('dashboard')}</BreadcrumbPage>
              </BreadcrumbItem>
            ) : (
              segments.map((s, index) => (
                <Fragment key={`${s.segment}-${index}`}>
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem className="min-w-0">
                    {s.isLast ? (
                      <BreadcrumbPage className="block max-w-[40ch] truncate">
                        {s.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        render={<Link href={s.href} className="block max-w-[20ch] truncate" />}>
                        {s.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              ))
            )}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onOpenContractorWizard}
                />
              }>
              <UserPlus className="h-4 w-4" />
              <span className="sr-only">{t('addContractor')}</span>
            </TooltipTrigger>
            <TooltipContent>{t('addContractor')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className={hasContractors ? 'h-8 w-8' : 'h-8 w-8 cursor-not-allowed opacity-50'}
                  aria-disabled={!hasContractors || undefined}
                  onClick={hasContractors ? onOpenContractWizard : undefined}
                />
              }>
              <FilePlus className="h-4 w-4" />
              <span className="sr-only">{t('newContract')}</span>
            </TooltipTrigger>
            <TooltipContent>
              {hasContractors ? t('newContract') : t('addContractorFirst')}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className={hasContractors ? 'h-8 w-8' : 'h-8 w-8 cursor-not-allowed opacity-50'}
                  aria-disabled={!hasContractors || undefined}
                  onClick={hasContractors ? onOpenInvoiceUpload : undefined}
                />
              }>
              <Upload className="h-4 w-4" />
              <span className="sr-only">{t('uploadInvoice')}</span>
            </TooltipTrigger>
            <TooltipContent>
              {hasContractors ? t('uploadInvoice') : t('addContractorFirst')}
            </TooltipContent>
          </Tooltip>

          <button
            type="button"
            onClick={onOpenSearch}
            className="search-trigger hidden md:flex h-9 w-[240px] items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground">
            <Search className="h-4 w-4" />
            <span>{t('search')}...</span>
            <kbd className="ms-auto rounded-md border border-border/60 bg-muted/60 px-1.5 py-0.5 text-[11px] font-mono font-medium text-muted-foreground shadow-[0_1px_0_0] shadow-border/40">
              {'⌘'}K
            </kbd>
          </button>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 md:hidden"
                  onClick={onOpenSearch}
                />
              }>
              <Search className="h-4 w-4" />
              <span className="sr-only">{t('search')}</span>
            </TooltipTrigger>
            <TooltipContent>{t('search')}</TooltipContent>
          </Tooltip>

          <NotificationPopoverContainer />
        </div>
      </header>
      <div className="accent-line sticky top-14 z-30 w-full" />
      <ContractWizardDialogContainer
        open={contractWizardOpen}
        onOpenChange={onContractWizardOpenChange}
      />
      <ContractorWizardDialogContainer
        open={contractorWizardOpen}
        onOpenChange={onContractorWizardOpenChange}
      />
      <IntakeUploadDialogContainer
        open={invoiceUploadOpen}
        onOpenChange={onInvoiceUploadOpenChange}
      />
      <CommandPaletteContainer />
    </>
  );
}
