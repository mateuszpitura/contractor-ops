/**
 * Client-side table of contents for privacy notices — ported from
 * apps/web/src/components/legal/privacy-notice-toc.tsx.
 */

import { cn } from '../../lib/utils.js';
import { usePrivacyNoticeToc } from './hooks/use-privacy-notice-toc.js';

export function PrivacyNoticeToc() {
  const { headings, activeId, label, heading } = usePrivacyNoticeToc();

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav aria-label={label} className="sticky top-24">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </p>
      <ol className="space-y-1.5 text-sm">
        {headings.map(item => {
          const isActive = item.id === activeId;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={isActive ? 'location' : undefined}
                className={cn(
                  'block rounded-md border-s-2 px-3 py-1.5 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  isActive
                    ? 'border-primary font-medium text-foreground'
                    : 'border-transparent text-muted-foreground',
                )}>
                {item.text}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
