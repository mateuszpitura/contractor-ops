/**
 * Tailwind class merge — lifted from apps/web/src/lib/utils.ts unchanged
 * (no Next imports). Step 11 codemod: zero swaps needed.
 */

import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
