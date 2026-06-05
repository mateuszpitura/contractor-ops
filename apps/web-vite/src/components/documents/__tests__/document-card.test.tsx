/**
 * The web-vite DocumentCardView is presentational: it takes a `cardActions`
 * bag and an optional `versionNumber`. The `pdf-preview` and
 * `version-history-container` children are tRPC-bound, so we mock them
 * here to avoid the network seam.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../pdf-preview.js', () => ({
  PdfPreviewContainer: ({ open }: { open: boolean }) =>
    open ? <div data-testid="pdf-preview">preview-open</div> : null,
}));

vi.mock('../version-history-container.js', () => ({
  VersionHistory: ({ documentId }: { documentId: string }) => (
    <div data-testid="version-history">{documentId}</div>
  ),
}));

vi.mock('../../../lib/format/use-date-formatter.js', () => ({
  useDateFormatter: () => ({
    formatDate: (v: unknown) => (typeof v === 'string' ? v : ''),
    formatTime: (v: unknown) => (typeof v === 'string' ? v : ''),
    formatDateTime: (v: unknown) => (typeof v === 'string' ? v : ''),
  }),
}));

import { DocumentCardView } from '../document-card.js';
import type { DocumentCardProps } from '../hooks/use-document-card.js';
import type { DocumentListItem } from '../types.js';
import { click, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

const baseDoc: DocumentListItem = {
  id: 'doc-1',
  originalFileName: 'invoice.pdf',
  mimeType: 'application/pdf',
  fileSizeBytes: 2048,
  virusScanStatus: 'CLEAN',
  createdAt: '2026-01-15',
  uploadedByUserId: 'u-1',
  status: 'ACTIVE',
};

function makeActions(overrides: Partial<DocumentCardProps> = {}): DocumentCardProps {
  return {
    document: baseDoc,
    isPdf: true,
    isInfected: false,
    canDownload: true,
    canUploadNewVersion: true,
    previewOpen: false,
    onPreviewOpenChange: vi.fn(),
    onOpenPreview: vi.fn(),
    deleteOpen: false,
    onDeleteOpenChange: vi.fn(),
    onOpenDelete: vi.fn(),
    isDeletePending: false,
    onConfirmDelete: vi.fn(),
    onDownload: vi.fn(),
    onUploadNewVersion: vi.fn(),
    ...overrides,
  };
}

describe('DocumentCardView (web-vite)', () => {
  it('renders the original filename + formatted date', async () => {
    const { container } = await mount(<DocumentCardView cardActions={makeActions()} />);
    expect(container.textContent).toContain('invoice.pdf');
    expect(container.textContent).toContain('2026-01-15');
  });

  it('renders the version badge when versionNumber is supplied', async () => {
    const { container } = await mount(
      <DocumentCardView versionNumber={3} cardActions={makeActions()} />,
    );
    expect(container.textContent).toContain('Version 3');
  });

  it('omits the version badge when versionNumber is null', async () => {
    const { container } = await mount(<DocumentCardView cardActions={makeActions()} />);
    expect(container.textContent).not.toContain('Version');
  });

  it('renders the clean scan badge for CLEAN documents', async () => {
    const { container } = await mount(<DocumentCardView cardActions={makeActions()} />);
    expect(container.textContent).toContain('Scan passed');
  });

  it('renders the infected badge + disables download for INFECTED docs', async () => {
    const { container } = await mount(
      <DocumentCardView
        cardActions={makeActions({
          document: { ...baseDoc, virusScanStatus: 'INFECTED' },
          isInfected: true,
          canDownload: false,
        })}
      />,
    );
    expect(container.textContent).toContain('Threat detected');
    // The download button should be rendered but disabled (the tooltip-
    // protected variant).
    const downloadBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      b => (b.textContent ?? '').includes('Download'),
    );
    expect(downloadBtn?.disabled).toBe(true);
  });

  it('invokes onOpenPreview when the preview button is clicked (PDF only)', async () => {
    const onOpenPreview = vi.fn();
    const { container } = await mount(
      <DocumentCardView cardActions={makeActions({ onOpenPreview })} />,
    );
    const previewBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b =>
      (b.textContent ?? '').includes('Preview'),
    );
    expect(previewBtn).toBeDefined();
    await click(previewBtn as HTMLButtonElement);
    expect(onOpenPreview).toHaveBeenCalledTimes(1);
  });

  it('invokes onDownload when the download button is clicked', async () => {
    const onDownload = vi.fn();
    const { container } = await mount(
      <DocumentCardView cardActions={makeActions({ onDownload })} />,
    );
    const dl = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b =>
      (b.textContent ?? '').includes('Download'),
    );
    await click(dl as HTMLButtonElement);
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('invokes onOpenDelete when the delete button is clicked', async () => {
    const onOpenDelete = vi.fn();
    const { container } = await mount(
      <DocumentCardView cardActions={makeActions({ onOpenDelete })} />,
    );
    const del = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      b => (b.textContent ?? '').includes('Delete') && !(b.textContent ?? '').includes('document'),
    );
    expect(del).toBeDefined();
    await click(del as HTMLButtonElement);
    expect(onOpenDelete).toHaveBeenCalledTimes(1);
  });

  it('renders the PDF preview slot only when previewOpen is true', async () => {
    const { container } = await mount(<DocumentCardView cardActions={makeActions()} />);
    expect(container.querySelector('[data-testid="pdf-preview"]')).toBeNull();

    const { container: openContainer } = await mount(
      <DocumentCardView cardActions={makeActions({ previewOpen: true })} />,
    );
    expect(openContainer.querySelector('[data-testid="pdf-preview"]')).not.toBeNull();
  });
});
