/**
 * Copyable field — single-line value with a copy-to-clipboard button that
 * flips to a check icon for 2 seconds on success.
 *
 * Ported from legacy `apps/web/src/components/shared/copyable-field.tsx`
 * (commit 62a97d73). Mechanical port — no platform-specific imports.
 */

import { Check, Copy } from 'lucide-react';
import { useCallback, useState } from 'react';

import { cn } from '../../lib/utils.js';

interface CopyableFieldProps {
  value: string;
  ariaLabel: string;
  className?: string;
}

export function CopyableField({ value, ariaLabel, className }: CopyableFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      // safe-swallow: clipboard write best-effort; insecure context/locked-down browser leaves value visible to select
    } catch {
      // Clipboard API unavailable (insecure context / locked-down browser) — fail silently.
    }
  }, [value]);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground',
        className,
      )}>
      <span className="font-mono text-sm">{value}</span>
      {copied ? (
        <Check
          className="size-3.5 text-emerald-500 transition-opacity duration-150 ease-in-out"
          aria-hidden="true"
        />
      ) : (
        <Copy className="size-3.5 transition-opacity duration-150 ease-in-out" aria-hidden="true" />
      )}
    </button>
  );
}
