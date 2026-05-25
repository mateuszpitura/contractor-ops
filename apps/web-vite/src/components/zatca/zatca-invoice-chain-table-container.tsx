import { useZatcaInvoiceChainTable } from './hooks/use-zatca-invoice-chain-table.js';
import type { ZatcaInvoiceChainTableViewProps } from './zatca-invoice-chain-table.js';
import {
  ZatcaInvoiceChainTableEmpty,
  ZatcaInvoiceChainTableSkeleton,
  ZatcaInvoiceChainTableView,
} from './zatca-invoice-chain-table.js';

export function ZatcaInvoiceChainTable(props: ZatcaInvoiceChainTableViewProps) {
  const { isLoading, entries, isFetching, refetchChain, t, ...rest } = useZatcaInvoiceChainTable(
    props.pageSize,
  );
  if (isLoading) return <ZatcaInvoiceChainTableSkeleton />;
  if (entries.length === 0) {
    return (
      <ZatcaInvoiceChainTableEmpty isFetching={isFetching} refetchChain={refetchChain} t={t} />
    );
  }
  return (
    <ZatcaInvoiceChainTableView
      entries={entries}
      isFetching={isFetching}
      refetchChain={refetchChain}
      t={t}
      {...rest}
    />
  );
}
