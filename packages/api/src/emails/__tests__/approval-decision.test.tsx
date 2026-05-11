import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { ApprovalDecisionEmail } from '../approval-decision';

function collectText(node: ReactNode): string[] {
  const out: string[] = [];
  function walk(n: ReactNode): void {
    if (n == null || typeof n === 'boolean') return;
    if (typeof n === 'string') {
      out.push(n);
      return;
    }
    if (typeof n === 'number') {
      out.push(String(n));
      return;
    }
    if (Array.isArray(n)) {
      for (const c of n) walk(c);
      return;
    }
    if (typeof n === 'object' && 'props' in (n as object)) {
      const el = n as ReactElement<{ children?: ReactNode; render?: unknown }>;
      walk(el.props.children);
    }
  }
  walk(node);
  return out;
}

function renderText(node: ReactNode): string {
  return collectText(node).join(' ');
}

describe('ApprovalDecisionEmail', () => {
  const minimalProps = {
    title: 'Invoice Approved',
    body: 'Your invoice has been approved.',
    ctaUrl: 'https://app.example.com/approvals/123',
    preferencesUrl: 'https://app.example.com/settings/notifications',
  };

  it('renders title and body with minimal props', () => {
    const tree = ApprovalDecisionEmail(minimalProps);
    const text = renderText(tree);

    expect(text).toContain('Invoice Approved');
    expect(text).toContain('Your invoice has been approved.');
  });

  it('renders decision, approver name, and comment when provided', () => {
    const tree = ApprovalDecisionEmail({
      ...minimalProps,
      decision: 'Approved',
      approverName: 'Anna Kowalska',
      comment: 'Looks good, proceed with payment.',
    });
    const text = renderText(tree);

    expect(text).toContain('Decision');
    expect(text).toContain('Approved');
    expect(text).toContain('By');
    expect(text).toContain('Anna Kowalska');
    expect(text).toContain('Comment');
    expect(text).toContain('Looks good, proceed with payment.');
  });

  it('omits decision section when decision is not provided', () => {
    const tree = ApprovalDecisionEmail(minimalProps);
    const text = renderText(tree);

    expect(text).not.toContain('Decision');
    expect(text).not.toContain('By');
    expect(text).not.toContain('Comment');
  });

  it('renders custom labels when provided', () => {
    const tree = ApprovalDecisionEmail({
      ...minimalProps,
      decision: 'Genehmigt',
      approverName: 'Max Mustermann',
      comment: 'Alles klar.',
      labels: {
        decision: 'Entscheidung',
        by: 'Von',
        comment: 'Kommentar',
      },
    });
    const text = renderText(tree);

    expect(text).toContain('Entscheidung');
    expect(text).toContain('Von');
    expect(text).toContain('Kommentar');
  });

  it('renders decision without approverName or comment', () => {
    const tree = ApprovalDecisionEmail({
      ...minimalProps,
      decision: 'Rejected',
    });
    const text = renderText(tree);

    expect(text).toContain('Decision');
    expect(text).toContain('Rejected');
    expect(text).not.toContain('By');
    expect(text).not.toContain('Comment');
  });
});
