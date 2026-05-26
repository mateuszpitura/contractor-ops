'use client';

import { ScrollProgress } from '@contractor-ops/ui/components/magic/scroll-progress';

export function ReadingProgress() {
  return (
    <ScrollProgress
      aria-hidden
      className="z-[60] h-[2px] bg-gradient-to-r from-primary via-primary/80 to-transparent"
    />
  );
}
