'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, Ban, Info, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/use-permissions';
import { Link } from '@/i18n/navigation';
import { enumKey } from '@/lib/enum-key';
import { canViewSensitivePii, maskTaxId } from '@/lib/mask-pii';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MatchResult = {
  matchScore: number | null;
  expectedAmountMinor: number | null;
  amountDeltaMinor: number | null;
  amountDeltaPercent: number | null;
  explanationJson: {
    flags?: string[];
    duplicateInvoiceId?: string | null;
  } | null;
  status: string;
};

type MatchCardProps = {
  invoice: {
    id: string;
    matchStatus: string;
    contractorId: string | null;
    contractId: string | null;
    totalMinor: number;
    currency: string;
    flagsJson: string[] | null;
    contractor: {
      id: string;
      legalName: string;
      taxId: string | null;
    } | null;
    contract: {
      id: string;
      title: string;
      type: string;
      status: string;
      rateValueMinor: number | null;
      currency: string;
    } | null;
    matchResults: MatchResult[];
  };
  onMatchConfirmed?: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMinorUnits(minor: number): string {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

// ---------------------------------------------------------------------------
// Confidence indicator config
// ---------------------------------------------------------------------------

function getConfidenceConfig(score: number) {
  if (score >= 90) {
    return { dotClass: 'bg-green-500', labelKey: 'strongMatch' as const };
  }
  if (score >= 50) {
    return { dotClass: 'bg-amber-500', labelKey: 'partialMatch' as const };
  }
  return { dotClass: 'bg-red-500', labelKey: 'weakMatch' as const };
}

// Flag display config
const FLAG_CONFIG: Record<
  string,
  {
    className: string;
    Icon: React.ComponentType<{ className?: string }>;
    labelKey: string;
  }
> = {
  NO_ACTIVE_CONTRACT: {
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    Icon: AlertCircle,
    labelKey: 'noActiveContract',
  },
  EXPIRED_CONTRACT: {
    className: 'bg-red-500/10 text-red-600 dark:text-red-400',
    Icon: AlertTriangle,
    labelKey: 'expiredContract',
  },
  CURRENCY_MISMATCH: {
    className: 'bg-red-500/10 text-red-600 dark:text-red-400',
    Icon: Ban,
    labelKey: 'currencyMismatch',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MatchCard({ invoice, onMatchConfirmed }: MatchCardProps) {
  const t = useTranslations('Invoices');
  const { role } = usePermissions();
  const showPii = canViewSensitivePii(role);
  const matchStatus = invoice.matchStatus;
  const latestResult = invoice.matchResults?.[0];
  const flags: string[] = Array.isArray(invoice.flagsJson) ? invoice.flagsJson : [];

  // Filter out DUPLICATE_SUSPECTED from match card flags (shown in separate banner)
  const displayFlags = flags.filter(f => f !== 'DUPLICATE_SUSPECTED');

  if (matchStatus === 'UNMATCHED') {
    return <UnmatchedCard invoiceId={invoice.id} onMatchConfirmed={onMatchConfirmed} />;
  }

  const isManual = matchStatus === 'MANUALLY_CONFIRMED';
  const score = latestResult?.matchScore ?? 0;
  const confidence = getConfidenceConfig(score);

  return (
    <Card className="bg-muted/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{t('match.heading')}</CardTitle>
          {isManual && (
            <Badge className="gap-1 bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Info className="h-3 w-3" />
              {t('match.manualMatch')}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Confidence indicator */}
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-muted-foreground">{t('match.confidence')}</span>
          <span className={`inline-block h-2 w-2 rounded-full ${confidence.dotClass}`} />
          <span className="text-sm font-medium">{t(`match.${enumKey(confidence.labelKey)}`)}</span>
          <span className="text-[13px] text-muted-foreground">{score}%</span>
        </div>

        {/* Matched contractor */}
        {!!invoice.contractor && (
          <div className="space-y-0.5">
            <span className="text-[13px] text-muted-foreground">{t('match.contractor')}</span>
            <div className="flex items-center gap-2">
              <Link
                href={`/contractors/${invoice.contractor.id}`}
                className="text-sm text-primary hover:underline">
                {invoice.contractor.legalName}
              </Link>
              {!!invoice.contractor.taxId && (
                <span className="font-mono text-[13px] text-muted-foreground">
                  {showPii ? invoice.contractor.taxId : maskTaxId(invoice.contractor.taxId)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Matched contract */}
        {!!invoice.contract && (
          <div className="space-y-0.5">
            <span className="text-[13px] text-muted-foreground">{t('match.contract')}</span>
            <div className="flex items-center gap-2">
              <Link
                href={`/contracts/${invoice.contract.id}`}
                className="text-sm text-primary hover:underline">
                {invoice.contract.title}
              </Link>
              <Badge variant="secondary" className="text-xs">
                {invoice.contract.type}
              </Badge>
            </div>
          </div>
        )}

        {/* Deviation display */}
        {latestResult?.expectedAmountMinor != null && latestResult.amountDeltaPercent != null && (
          <div className="space-y-1 rounded-md border bg-background p-3">
            <div className="flex justify-between text-[13px]">
              <span className="text-muted-foreground">{t('match.expected')}</span>
              <span className="font-mono">
                {formatMinorUnits(latestResult.expectedAmountMinor)} {invoice.currency}
              </span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-muted-foreground">{t('match.actual')}</span>
              <span className="font-mono">
                {formatMinorUnits(invoice.totalMinor)} {invoice.currency}
              </span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-muted-foreground">{t('match.deviation')}</span>
              <span
                className={`font-mono font-medium ${
                  Math.abs(latestResult.amountDeltaPercent) > 10
                    ? 'text-destructive'
                    : 'text-green-600 dark:text-green-400'
                }`}>
                {latestResult.amountDeltaPercent > 0 ? '+' : ''}
                {latestResult.amountDeltaPercent.toFixed(1)}%
                {Math.abs(latestResult.amountDeltaPercent) > 10 && (
                  <AlertTriangle className="ms-1 inline h-3 w-3" />
                )}
              </span>
            </div>
          </div>
        )}

        {/* Flags */}
        {displayFlags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {displayFlags.map(flag => {
              const config = FLAG_CONFIG[flag];
              if (!config) return null;
              const { className, Icon, labelKey } = config;
              return (
                <Badge key={flag} variant="secondary" className={`gap-1 ${className}`}>
                  <Icon className="h-3 w-3" />
                  {t(`match.${enumKey(labelKey)}`)}
                </Badge>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Unmatched card — contractor search + contract picker
// ---------------------------------------------------------------------------

function UnmatchedCard({
  invoiceId,
  onMatchConfirmed,
}: {
  invoiceId: string;
  onMatchConfirmed?: () => void;
}) {
  const t = useTranslations('Invoices');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContractorId, setSelectedContractorId] = useState<string | null>(null);
  const [selectedContractorName, setSelectedContractorName] = useState('');
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [contractorPopoverOpen, setContractorPopoverOpen] = useState(false);

  // Debounced search for contractors
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    const timeout = setTimeout(() => setDebouncedQuery(value), 300);
    return () => clearTimeout(timeout);
  }, []);

  const contractorsQuery = useQuery({
    ...trpc.invoice.searchContractors.queryOptions({
      query: debouncedQuery,
    }),
    enabled: debouncedQuery.length >= 1,
  });

  // Fetch contracts for selected contractor
  const contractsQuery = useQuery({
    ...trpc.invoice.contractsForContractor.queryOptions({
      contractorId: selectedContractorId ?? '',
    }),
    enabled: !!selectedContractorId,
  });

  const contractors = contractorsQuery.data ?? [];
  const contracts = contractsQuery.data ?? [];

  // Manual match mutation
  const manualMatchMutation = useMutation(
    trpc.invoice.manualMatch.mutationOptions({
      onSuccess: () => {
        toast.success(t('match.matchConfirmedToast'));
        onMatchConfirmed?.();
      },
      onError: () => {
        toast.error(t('match.matchError'));
      },
    }),
  );

  function handleConfirmMatch() {
    if (!selectedContractorId) return;
    manualMatchMutation.mutate({
      invoiceId,
      contractorId: selectedContractorId,
      contractId: selectedContractId ?? undefined,
    });
  }

  return (
    <Card className="bg-amber-500/5 border-amber-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('match.noMatch')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Contractor search picker */}
        <div className="space-y-1.5">
          <span className="text-[13px] text-muted-foreground">{t('match.contractor')}</span>
          <Popover open={contractorPopoverOpen} onOpenChange={setContractorPopoverOpen}>
            <PopoverTrigger
              render={
                <Button variant="outline" className="w-full justify-start text-start font-normal" />
              }>
              {selectedContractorName || t('match.searchContractor')}
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder={t('match.searchContractor')}
                  value={searchQuery}
                  onValueChange={handleSearchChange}
                />
                <CommandList>
                  <CommandEmpty>
                    {contractorsQuery.isLoading ? (
                      <div className="space-y-2 p-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">No contractors found</span>
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    {contractors.map(
                      (contractor: {
                        id: string;
                        legalName: string;
                        taxId: string | null;
                        status: string;
                      }) => (
                        <CommandItem
                          key={contractor.id}
                          value={contractor.id}
                          // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
                          onSelect={() => {
                            setSelectedContractorId(contractor.id);
                            setSelectedContractorName(contractor.legalName);
                            setSelectedContractId(null);
                            setContractorPopoverOpen(false);
                          }}>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm">{contractor.legalName}</span>
                            <div className="flex items-center gap-2">
                              {!!contractor.taxId && (
                                <span className="font-mono text-xs text-muted-foreground">
                                  {contractor.taxId}
                                </span>
                              )}
                              <Badge variant="secondary" className="text-xs">
                                {contractor.status}
                              </Badge>
                            </div>
                          </div>
                        </CommandItem>
                      ),
                    )}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Contract picker */}
        {!!selectedContractorId && (
          <div className="space-y-1.5">
            <span className="text-[13px] text-muted-foreground">{t('match.contract')}</span>
            {contractsQuery.isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : contracts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('match.noContracts')}</p>
            ) : (
              <Select
                value={selectedContractId ?? undefined}
                // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                onValueChange={val => setSelectedContractId(val)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('match.selectContract')} />
                </SelectTrigger>
                <SelectContent>
                  {contracts.map(
                    (contract: { id: string; title: string; type: string; status: string }) => (
                      <SelectItem key={contract.id} value={contract.id}>
                        <div className="flex items-center gap-2">
                          <span>{contract.title}</span>
                          <Badge variant="secondary" className="text-xs">
                            {contract.type}
                          </Badge>
                        </div>
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Confirm match CTA */}
        <Button
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={handleConfirmMatch}
          disabled={!selectedContractorId || manualMatchMutation.isPending}
          className="w-full">
          {!!manualMatchMutation.isPending && (
            <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
          )}
          {t('match.confirmMatch')}
        </Button>
      </CardContent>
    </Card>
  );
}
