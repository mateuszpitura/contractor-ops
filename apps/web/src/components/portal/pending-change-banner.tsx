'use client';

import { ChevronDown, Clock } from 'lucide-react';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { usePortalDateFormatter } from '@/lib/format/use-portal-date-formatter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PendingChangeBannerProps {
  pendingChangeRequest: {
    requestedChanges: Record<string, unknown>;
    createdAt: Date;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  bankAccountNumber: 'Bank Account Number',
  bankName: 'Bank Name',
  swiftBic: 'SWIFT/BIC Code',
  taxId: 'Tax ID (NIP)',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Warning banner for pending financial change requests.
 * Displays at the top of the Financial Details section when a change
 * request is pending approval (D-04, UI-SPEC).
 */
export function PendingChangeBanner({ pendingChangeRequest }: PendingChangeBannerProps) {
  const { formatDate } = usePortalDateFormatter();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const changes = pendingChangeRequest.requestedChanges;
  const changeEntries = Object.entries(changes).filter(
    ([, value]) => value !== undefined && value !== null,
  );

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
      <div className="flex items-start gap-3">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            Changes Pending Approval
          </p>
          <p className="text-sm text-amber-700/80 dark:text-amber-400/80">
            You submitted changes on {formatDate(pendingChangeRequest.createdAt)}. Your current
            details remain active until approved.
          </p>

          {changeEntries.length > 0 && (
            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <CollapsibleTrigger
                // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
                render={props => (
                  <button
                    {...props}
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300">
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${
                        detailsOpen ? 'rotate-180' : ''
                      }`}
                    />
                    View submitted changes
                  </button>
                )}
              />
              <CollapsibleContent>
                <div className="mt-3 space-y-2">
                  {changeEntries.map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm text-amber-700/70 dark:text-amber-400/70">
                        {FIELD_LABELS[key] ?? key}
                      </span>
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        {String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    </div>
  );
}
