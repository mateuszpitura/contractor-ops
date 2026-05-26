/**
 * Ported from apps/web/src/components/workflows/__tests__/workflow-nav-badge.test.tsx.
 *
 * Web-vite split: WorkflowNavBadge takes `{ count }` (produced by the
 * `useWorkflowNavBadge` hook).
 */

import { afterEach, describe, expect, it } from 'vitest';
import { WorkflowNavBadge } from '../workflow-nav-badge.js';
import { findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('WorkflowNavBadge (web-vite)', () => {
  it('renders nothing when count is 0', async () => {
    const { container } = await mount(<WorkflowNavBadge count={0} />);
    expect(container.textContent ?? '').toBe('');
  });

  it('renders the literal count between 1 and 9', async () => {
    await mount(<WorkflowNavBadge count={5} />);
    expect(findByText(document.body, '5')).not.toBeNull();
  });

  it('caps display at "9+" for counts greater than 9', async () => {
    await mount(<WorkflowNavBadge count={42} />);
    expect(findByText(document.body, '9+')).not.toBeNull();
  });

  it('marks the badge with role="status"', async () => {
    const { container } = await mount(<WorkflowNavBadge count={3} />);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });
});
