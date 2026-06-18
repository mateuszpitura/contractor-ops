import type { ReactNode } from 'react';

export interface AtelierPanelProps {
  /** Panel header content (title + optional close button rendered by caller). */
  header?: ReactNode;
  /** Scrollable body. */
  children: ReactNode;
  /** Optional sticky footer — typically primary action + cancel. */
  footer?: ReactNode;
  /**
   * Glass tier for the panel surface. Defaults to 'medium' which
   * matches the Atelier dashboard cards. Side panels on Workbench
   * pages should pass 'subtle' to stay calm.
   */
  surface?: 'subtle' | 'medium';
}

/**
 * Surface for a side-panel / detail-drawer. Caller is responsible for
 * the open/close mechanism (Sheet, Dialog, or custom positioning) —
 * this primitive is purely visual chrome: header, scrollable body,
 * sticky footer.
 *
 * Defaults to glass-medium to match Atelier-tier modals; pass
 * surface="subtle" on Workbench pages where dense data is expected.
 */
export function AtelierPanel({ header, children, footer, surface = 'medium' }: AtelierPanelProps) {
  const glassClass = surface === 'subtle' ? 'glass-subtle' : 'glass-medium';
  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-2xl ${glassClass}`}>
      {header == null ? null : (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 px-5 py-3">
          {header}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer == null ? null : (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/40 bg-card/40 px-5 py-3">
          {footer}
        </div>
      )}
    </div>
  );
}
