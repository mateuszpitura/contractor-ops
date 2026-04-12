'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

interface CopyableFieldProps {
  value: string;
  ariaLabel: string;
  className?: string;
}

export function CopyableField({ value, ariaLabel, className }: CopyableFieldProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — fail silently
    }
  }

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
