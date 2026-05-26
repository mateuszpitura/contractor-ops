import { useFlag } from '../../layout/feature-flag-context.js';

export function useEinvoiceImportEnabled(): boolean {
  return useFlag('einvoice.import-enabled');
}
