/**
 * web-vite port. Mocks tRPC-bound DropZone + DocumentCard.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../documents/drop-zone.js', () => ({
  DropZoneContainer: () => <div data-testid="drop-zone" />,
}));

vi.mock('../../../documents/document-card.js', () => ({
  DocumentCardContainer: ({ document }: { document: { id: string; filename: string } }) => (
    <div data-testid={`doc-${document.id}`}>{document.filename}</div>
  ),
}));

import { render, screen } from '../../../../test/test-utils.js';
import type { DocumentListItem } from '../../../documents/types.js';
import { TabDocuments, TabDocumentsEmpty, TabDocumentsSkeleton } from '../tab-documents.js';

const sampleDoc = (id: string, filename: string): DocumentListItem =>
  ({
    id,
    filename,
  }) as unknown as DocumentListItem;

describe('TabDocuments', () => {
  it('renders skeleton rows while loading', () => {
    const { container } = render(<TabDocumentsSkeleton contractorId="c1" />);
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders empty state when no documents', () => {
    render(<TabDocumentsEmpty contractorId="c1" />);
    expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
  });

  it('renders document cards when documents exist', () => {
    render(
      <TabDocuments
        contractorId="c1"
        documents={[sampleDoc('d1', 'NDA.pdf'), sampleDoc('d2', 'MSA.pdf')]}
      />,
    );
    expect(screen.getByTestId('doc-d1')).toBeInTheDocument();
    expect(screen.getByTestId('doc-d2')).toBeInTheDocument();
  });

  it('always mounts the drop-zone (upload affordance)', () => {
    render(<TabDocumentsEmpty contractorId="c1" />);
    expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
  });
});
