import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import type { SectionDocument, SectionRetention } from '../hooks/use-personnel-file.js';
import { PersonnelFileSectionCard } from '../personnel-file-section-card.js';

const whileEmployed: SectionRetention = {
  retainUntil: null,
  citation: null,
  indefinite: true,
};

function makeDocument(id: string): SectionDocument {
  return {
    id,
    documentId: `doc-${id}`,
    section: null,
    documentDate: new Date('2026-03-12T00:00:00Z'),
    classificationMethod: 'DETERMINISTIC',
    createdAt: new Date('2026-03-12T00:00:00Z'),
  };
}

const noop = () => {};

describe('PersonnelFileSectionCard', () => {
  it('renders a locked section conspicuously with NO document body or count', () => {
    const { container } = render(
      <PersonnelFileSectionCard
        section="A"
        jurisdiction="PL"
        state="locked"
        retention={whileEmployed}
        documents={[]}
        onRetry={noop}
      />,
    );

    // Title stays visible — the section's existence is not hidden.
    expect(screen.getByText('Recruitment records (Part A)')).toBeInTheDocument();
    // The blocked status badge announces the lock.
    expect(screen.getByLabelText('Locked')).toBeInTheDocument();

    // No document rows, no empty/error body — the locked card mounts no content.
    expect(screen.queryByText('Personnel document')).not.toBeInTheDocument();
    expect(screen.queryByText('No documents in this section yet')).not.toBeInTheDocument();
    expect(screen.queryByText("Couldn't load this section")).not.toBeInTheDocument();

    // The locked control is inert but reachable via Tab (aria-disabled, tabindex 0).
    const lockedControl = container.querySelector('[aria-disabled="true"]');
    expect(lockedControl).not.toBeNull();
    expect(lockedControl?.getAttribute('tabindex')).toBe('0');
  });

  it('renders the empty state with the section-scoped copy', () => {
    render(
      <PersonnelFileSectionCard
        section="B"
        jurisdiction="DE"
        state="empty"
        retention={whileEmployed}
        documents={[]}
        onRetry={noop}
      />,
    );

    expect(screen.getByText('Contract & pay')).toBeInTheDocument();
    expect(screen.getByText('No documents in this section yet')).toBeInTheDocument();
    expect(screen.queryByLabelText('Locked')).not.toBeInTheDocument();
  });

  it('renders a section-scoped error whose Retry re-triggers only that section', async () => {
    const onRetry = vi.fn();
    const { user } = setup(
      <PersonnelFileSectionCard
        section="C"
        jurisdiction="UK"
        state="error"
        retention={whileEmployed}
        documents={[]}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText("Couldn't load this section")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders one row per document in the populated state', () => {
    render(
      <PersonnelFileSectionCard
        section="A"
        jurisdiction="US"
        state="populated"
        retention={whileEmployed}
        documents={[makeDocument('1'), makeDocument('2')]}
        onRetry={noop}
      />,
    );

    expect(screen.getByText('I-9 & work authorization')).toBeInTheDocument();
    expect(screen.getAllByText('Personnel document')).toHaveLength(2);
    // A statutory jurisdiction carries the citation chip on the header.
    expect(screen.getByText('Statutory')).toBeInTheDocument();
  });
});
