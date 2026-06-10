/**
 * Tests target `DocLinksSectionView` with shaped props. Sibling DocLinkChip and
 * AttachDocDialog containers are stubbed; we focus on heading + attach button,
 * the empty/loaded branches, and the detach confirmation dialog state.
 */

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TranslateFn } from '@/i18n/useTranslations';
import { render, screen, setup } from '@/test/test-utils';
import type { DocLinksSectionViewProps } from '../doc-links-section';
import { DocLinksSectionSkeleton, DocLinksSectionView } from '../doc-links-section';

vi.mock('../attach-doc-dialog.js', () => ({
  AttachDocDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="attach-dialog" /> : null,
}));

vi.mock('../doc-link-chip', () => ({
  DocLinkChip: ({ title, id }: { title: string; id: string }) => (
    <div data-testid="doc-link-chip" data-id={id}>
      {title}
    </div>
  ),
}));

vi.mock('@contractor-ops/ui/components/shadcn/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: ReactNode; open?: boolean }) =>
    open ? <div data-testid="detach-alert">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  AlertDialogAction: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

const mockLinks = [
  {
    id: 'lk-1',
    externalUrl: 'https://notion.so/design',
    externalType: 'NOTION_PAGE',
    metadataJson: { title: 'Design Doc' },
  },
  {
    id: 'lk-2',
    externalUrl: 'https://confluence.com/api',
    externalType: 'CONFLUENCE_PAGE',
    metadataJson: { title: 'API Spec' },
  },
];

interface BuildOpts {
  readOnly?: boolean;
  docLinks?: typeof mockLinks;
  attachOpen?: boolean;
  pendingDetachId?: string | null;
  refreshingId?: string | null;
  isDetachPending?: boolean;
  isRefreshPending?: boolean;
  openAttachDialog?: () => void;
  setAttachOpen?: Dispatch<SetStateAction<boolean>>;
  setPendingDetachId?: Dispatch<SetStateAction<string | null>>;
  confirmRemove?: () => void;
  handleRefresh?: (id: string) => void;
  handleRemove?: (id: string) => void;
}

function buildProps(overrides: BuildOpts = {}): DocLinksSectionViewProps {
  const {
    readOnly = false,
    docLinks = mockLinks,
    attachOpen = false,
    pendingDetachId = null,
    refreshingId = null,
    isDetachPending = false,
    isRefreshPending = false,
    openAttachDialog = vi.fn(),
    setAttachOpen = vi.fn(),
    setPendingDetachId = vi.fn(),
    confirmRemove = vi.fn(),
    handleRefresh = vi.fn(),
    handleRemove = vi.fn(),
  } = overrides;

  const t = ((key: string): string => {
    const messages: Record<string, string> = {
      'docs.section.heading': 'Documents',
      'docs.section.attachButton': 'Attach Document',
      'docs.section.noDocuments': 'No documents attached.',
      'docs.section.untitled': 'Untitled',
      'docs.section.detachConfirm': 'Detach document',
      'docs.section.detachCancel': 'Keep linked',
      'docs.section.detachConfirmTitle': 'Detach this document?',
      'docs.section.detachConfirmBody':
        'Detaching unlinks the document from this section but does not delete the file itself.',
    };
    return messages[key] ?? key;
  }) as TranslateFn;

  return {
    readOnly,
    workflowTaskRunId: 'wtr-1',
    attachOpen,
    setAttachOpen,
    pendingDetachId,
    setPendingDetachId,
    detachMutation: { isPending: isDetachPending } as never,
    refreshMutation: { isPending: isRefreshPending } as never,
    handleRefresh,
    handleRemove,
    confirmRemove,
    openAttachDialog,
    docLinks,
    refreshingId,
    variant: docLinks.length === 0 ? 'empty' : 'list',
    t,
  };
}

describe('DocLinksSectionView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('DocLinksSectionSkeleton renders skeletons + heading', () => {
    const t = ((key: string): string => {
      const messages: Record<string, string> = {
        'docs.section.heading': 'Documents',
        'docs.section.attachButton': 'Attach Document',
      };
      return messages[key] ?? key;
    }) as TranslateFn;
    const { container } = render(<DocLinksSectionSkeleton t={t} />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.getByText('Documents')).toBeInTheDocument();
  });

  it('renders the section heading', () => {
    render(<DocLinksSectionView {...buildProps()} />);
    expect(screen.getByText('Documents')).toBeInTheDocument();
  });

  it('shows the attach button when not readOnly', () => {
    render(<DocLinksSectionView {...buildProps()} />);
    expect(screen.getByRole('button', { name: 'Attach Document' })).toBeInTheDocument();
  });

  it('hides the attach button in readOnly mode', () => {
    render(<DocLinksSectionView {...buildProps({ readOnly: true })} />);
    expect(screen.queryByRole('button', { name: 'Attach Document' })).not.toBeInTheDocument();
  });

  it('shows the empty hint when no links and not loading', () => {
    render(<DocLinksSectionView {...buildProps({ docLinks: [] })} />);
    expect(screen.getByText('No documents attached.')).toBeInTheDocument();
  });

  it('renders one chip per doc link', () => {
    render(<DocLinksSectionView {...buildProps()} />);
    const chips = screen.getAllByTestId('doc-link-chip');
    expect(chips).toHaveLength(mockLinks.length);
    expect(screen.getByText('Design Doc')).toBeInTheDocument();
    expect(screen.getByText('API Spec')).toBeInTheDocument();
  });

  it('opens the attach dialog mock when attachOpen prop is true', () => {
    render(<DocLinksSectionView {...buildProps({ attachOpen: true })} />);
    expect(screen.getByTestId('attach-dialog')).toBeInTheDocument();
  });

  it('renders the detach alert only when pendingDetachId is set', () => {
    const { rerender } = render(<DocLinksSectionView {...buildProps()} />);
    expect(screen.queryByTestId('detach-alert')).not.toBeInTheDocument();

    rerender(<DocLinksSectionView {...buildProps({ pendingDetachId: 'lk-1' })} />);
    expect(screen.getByTestId('detach-alert')).toBeInTheDocument();
    expect(screen.getByText('Detach this document?')).toBeInTheDocument();
  });

  it('calls confirmRemove when the detach button in the alert is clicked', async () => {
    const confirmRemove = vi.fn();
    const { user } = setup(
      <DocLinksSectionView {...buildProps({ pendingDetachId: 'lk-1', confirmRemove })} />,
    );
    await user.click(screen.getByRole('button', { name: 'Detach document' }));
    expect(confirmRemove).toHaveBeenCalledTimes(1);
  });

  it('calls openAttachDialog when the attach button is clicked', async () => {
    const openAttachDialog = vi.fn();
    const { user } = setup(<DocLinksSectionView {...buildProps({ openAttachDialog })} />);
    await user.click(screen.getByRole('button', { name: 'Attach Document' }));
    expect(openAttachDialog).toHaveBeenCalledTimes(1);
  });
});
