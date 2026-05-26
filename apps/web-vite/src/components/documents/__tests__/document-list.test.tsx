/**
 * Step 10 port of apps/web/src/components/documents/__tests__/document-list.test.tsx.
 *
 * DocumentList is a presentational wrapper that switches between three
 * states (loading → empty → children). The data fetching belongs to the
 * container.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { DocumentList } from '../document-list.js';
import { mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('DocumentList (web-vite)', () => {
  it('renders skeleton placeholders while loading', async () => {
    const { container } = await mount(
      <DocumentList isLoading={true} isEmpty={false}>
        <div>should not show</div>
      </DocumentList>,
    );
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('should not show');
  });

  it('renders the empty state when isEmpty is true', async () => {
    const { container } = await mount(
      <DocumentList isLoading={false} isEmpty={true}>
        <div>should not show</div>
      </DocumentList>,
    );
    expect(container.textContent).toContain('No documents yet');
    expect(container.textContent).toContain('Upload contract documents');
    expect(container.textContent).not.toContain('should not show');
  });

  it('renders children when there is data', async () => {
    const { container } = await mount(
      <DocumentList isLoading={false} isEmpty={false}>
        <div data-testid="row">row 1</div>
        <div data-testid="row">row 2</div>
      </DocumentList>,
    );
    expect(container.querySelectorAll('[data-testid="row"]').length).toBe(2);
  });

  it('prefers the loading branch over the empty branch when both are true', async () => {
    const { container } = await mount(
      <DocumentList isLoading={true} isEmpty={true}>
        <div>nope</div>
      </DocumentList>,
    );
    // Loading wins — skeletons render, empty heading does not.
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('No documents yet');
  });
});
