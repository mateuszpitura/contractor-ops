// ---------------------------------------------------------------------------
// Outcome print layout wrapper — Phase 58 Plan 05 Task 1.
// ---------------------------------------------------------------------------
// Applies @media print styles that force-expand all Collapsibles, hide
// interactive chrome, and preserve semantic-triad colours. Ships as a single
// wrapper component so the outcome page keeps its SSR-friendly shape.
//
// The style block is inlined via a <style> tag rather than global CSS so the
// rules only activate on routes that mount this wrapper — the rest of the
// dashboard keeps its own print styles.

import type { ReactNode } from 'react';

export interface OutcomePrintLayoutProps {
  readonly children: ReactNode;
  readonly header?: ReactNode;
  readonly footer?: ReactNode;
  readonly 'data-testid'?: string;
}

// Raw CSS string — double-braced className selectors don't work inside JSX
// style tags, so we emit plain CSS scoped via the wrapper class.
const PRINT_STYLES = `
.classification-outcome-print-layout {
  --outcome-print-header-opacity: 0.8;
}
@media print {
  body {
    background: #fff !important;
  }
  .classification-outcome-print-layout [data-slot="collapsible-content"] {
    display: block !important;
    height: auto !important;
    overflow: visible !important;
    animation: none !important;
  }
  .classification-outcome-print-layout [data-slot="collapsible-trigger"] {
    pointer-events: none;
    opacity: var(--outcome-print-header-opacity);
  }
  .classification-outcome-print-layout .outcome-no-print,
  .classification-outcome-print-layout [data-no-print="true"] {
    display: none !important;
  }
  .classification-outcome-print-layout .outcome-print-only {
    display: block !important;
  }
  .classification-outcome-print-layout [role="status"][data-testid="verdict-banner"] {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .classification-outcome-print-layout [data-testid="ir35-area-card"],
  .classification-outcome-print-layout [data-testid="drv-category-bar"] {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-bottom: 1rem;
  }
}
.outcome-print-only {
  display: none;
}
`;

export function OutcomePrintLayout(props: OutcomePrintLayoutProps) {
  const { children, header, footer } = props;
  return (
    <div
      className="classification-outcome-print-layout flex flex-col gap-6"
      data-testid={props['data-testid'] ?? 'outcome-print-layout'}>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />
      {header ? <div className="outcome-print-only border-b pb-3">{header}</div> : null}
      <div className="flex flex-col gap-6">{children}</div>
      {footer ? <div className="outcome-print-only border-t pt-3">{footer}</div> : null}
    </div>
  );
}
