import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { TaskAssignedEmail } from '../task-assigned.js';

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

describe('TaskAssignedEmail', () => {
  const minimalProps = {
    title: 'New Task Assigned',
    body: 'You have been assigned a new task.',
    ctaUrl: 'https://app.example.com/tasks/101',
    preferencesUrl: 'https://app.example.com/settings/notifications',
  };

  it('renders title and body with minimal props', () => {
    const tree = TaskAssignedEmail(minimalProps);
    const text = renderText(tree);

    expect(text).toContain('New Task Assigned');
    expect(text).toContain('You have been assigned a new task.');
  });

  it('renders task details when all optional props are provided', () => {
    const tree = TaskAssignedEmail({
      ...minimalProps,
      taskName: 'Review contractor onboarding docs',
      workflowName: 'Onboarding Workflow',
      dueDate: '2026-04-20',
    });
    const text = renderText(tree);

    expect(text).toContain('Task');
    expect(text).toContain('Review contractor onboarding docs');
    expect(text).toContain('Workflow');
    expect(text).toContain('Onboarding Workflow');
    expect(text).toContain('Due');
    expect(text).toContain('2026-04-20');
  });

  it('omits details section when taskName is not provided', () => {
    const tree = TaskAssignedEmail(minimalProps);
    const text = renderText(tree);

    expect(text).not.toContain('Workflow');
    expect(text).not.toContain('Due');
  });

  it('renders custom labels when provided', () => {
    const tree = TaskAssignedEmail({
      ...minimalProps,
      taskName: 'Dokumente prüfen',
      workflowName: 'Einarbeitungs-Workflow',
      dueDate: '20.04.2026',
      labels: {
        task: 'Aufgabe',
        workflow: 'Arbeitsablauf',
        due: 'Fällig',
      },
    });
    const text = renderText(tree);

    expect(text).toContain('Aufgabe');
    expect(text).toContain('Arbeitsablauf');
    expect(text).toContain('Fällig');
  });

  it('renders taskName without workflowName or dueDate', () => {
    const tree = TaskAssignedEmail({
      ...minimalProps,
      taskName: 'Upload signed contract',
    });
    const text = renderText(tree);

    expect(text).toContain('Task');
    expect(text).toContain('Upload signed contract');
    expect(text).not.toContain('Workflow');
    expect(text).not.toContain('Due');
  });
});
