'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrialBannerProps {
  trialEnd: Date;
  onUpgrade: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TrialBanner({ trialEnd, onUpgrade }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const daysRemaining = Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  // Only render during last 7 days of trial, and only if not expired
  if (daysRemaining <= 0 || daysRemaining > 7 || dismissed) {
    return null;
  }

  const message = getTrialMessage(daysRemaining);

  return (
    <div
      role="alert"
      aria-live="polite"
      className="relative w-full border-l-4 border-warning bg-warning/10 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium">{message}</p>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={onUpgrade}>
            Choose a plan
          </Button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Dismiss trial banner">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTrialMessage(daysRemaining: number): string {
  switch (daysRemaining) {
    case 7:
      return 'Your trial ends in 7 days. Upgrade to keep your data and full access.';
    case 3:
      return 'Your trial ends in 3 days. Choose a plan to continue without interruption.';
    case 1:
      return 'Your trial ends tomorrow. Upgrade now to avoid losing access to features.';
    default:
      return `Your trial ends in ${daysRemaining} days. Upgrade to keep your data and full access.`;
  }
}
