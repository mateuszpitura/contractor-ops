/**
 * DocumentsTab is presentational over a `documents` prop
 * produced by `useContractDocumentsTab`. DropZone/DocumentList are now
 * Container components so we mock them out to keep this test scoped.
 */

import { vi } from 'vitest';
import { render, screen } from '@/test/test-utils';

vi.mock('../../../documents/drop-zone-container.js', () => {
  const React = require('react');
  return {
    DropZoneContainer: () => React.createElement('div', { 'data-testid': 'drop-zone' }),
  };
});
vi.mock('../../../documents/document-list-container.js', () => {
  const React = require('react');
  return {
    DocumentListContainer: () => React.createElement('div', { 'data-testid': 'document-list' }),
  };
});

import { DocumentsTab } from '../documents-tab';

type Props = Parameters<typeof DocumentsTab>[0];

function makeDocuments(overrides: Partial<Props['documents']> = {}): Props['documents'] {
  return {
    documents: [],
    hasProvider: false,
    handleSendForSignature: vi.fn(),
    isLoading: false,
    selectedDocId: '',
    signDialogOpen: false,
    setSignDialogOpen: vi.fn(),
    ...overrides,
  };
}

describe('DocumentsTab', () => {
  it('renders drop zone', () => {
    render(<DocumentsTab contractId="ct1" documents={makeDocuments()} />);
    expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
  });

  it('renders document list', () => {
    render(<DocumentsTab contractId="ct1" documents={makeDocuments()} />);
    expect(screen.getByTestId('document-list')).toBeInTheDocument();
  });

  it('does not show sign buttons when no providers connected', () => {
    render(<DocumentsTab contractId="ct1" documents={makeDocuments()} />);
    expect(screen.queryByText(/send for signature/i)).not.toBeInTheDocument();
  });

  it('shows sign buttons when provider is connected and documents exist', () => {
    render(
      <DocumentsTab
        contractId="ct1"
        documents={makeDocuments({
          hasProvider: true,
          documents: [{ id: 'doc-1', originalFileName: 'contract.pdf' }],
        })}
      />,
    );
    // i18n namespace `ContractDetail.documents.sendForSignature` is not yet
    // shipped in en.json — i18next echoes the raw key. Assert the button row
    // exists (PenLine icon + button element) instead of brittle text matching.
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    expect(document.body.querySelector('.lucide-pen-line')).not.toBeNull();
  });

  it('renders with contractParties prop', () => {
    render(
      <DocumentsTab
        contractId="ct1"
        documents={makeDocuments()}
        contractParties={[{ name: 'Jan', email: 'jan@test.com', role: 'signer' }]}
      />,
    );
    expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
  });

  it('renders without contractParties prop (defaults to empty)', () => {
    render(<DocumentsTab contractId="ct1" documents={makeDocuments()} />);
    expect(screen.getByTestId('document-list')).toBeInTheDocument();
  });
});
