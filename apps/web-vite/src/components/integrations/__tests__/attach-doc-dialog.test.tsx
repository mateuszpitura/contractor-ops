/**
 * Tests target `AttachDocDialogView` directly with shaped hook + open/onOpenChange
 * props. Component/hook split means tRPC is wired in the container; the view is
 * pure-render.
 */

import type { Dispatch, SetStateAction } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TranslateFn } from '@/i18n/useTranslations';
import { render, screen, setup } from '@/test/test-utils';
import type { AttachDocDialogViewProps } from '../attach-doc-dialog';
import { AttachDocDialogView } from '../attach-doc-dialog';
import type { DocSearchResult, ProviderFilter } from '../hooks/use-attach-doc-dialog';

vi.mock('../provider-icons', () => ({
  NotionIcon: ({ className }: { className?: string }) => (
    <span data-testid="notion-icon" className={className} />
  ),
  ConfluenceIcon: ({ className }: { className?: string }) => (
    <span data-testid="confluence-icon" className={className} />
  ),
}));

const mockResults = [
  {
    id: 'page-1',
    title: 'Design System',
    icon: null,
    subtitle: 'Engineering',
    url: 'https://notion.so/page-1',
    provider: 'notion' as const,
  },
  {
    id: 'page-2',
    title: 'API Docs',
    icon: null,
    subtitle: 'Docs Space',
    url: 'https://confluence.com/page-2',
    provider: 'confluence' as const,
  },
];

interface BuildOpts {
  open?: boolean;
  query?: string;
  debouncedQuery?: string;
  providerFilter?: ProviderFilter;
  results?: typeof mockResults;
  searchLoading?: boolean;
  attachPending?: boolean;
  onOpenChange?: (open: boolean) => void;
  setQuery?: Dispatch<SetStateAction<string>>;
  setProviderFilter?: Dispatch<SetStateAction<ProviderFilter>>;
  handleSelect?: (result: DocSearchResult) => void;
}

function buildProps(overrides: BuildOpts = {}): AttachDocDialogViewProps {
  const {
    open = true,
    query = '',
    debouncedQuery = '',
    providerFilter = 'all',
    results = [],
    searchLoading = false,
    attachPending = false,
    onOpenChange = vi.fn(),
    setQuery = vi.fn(),
    setProviderFilter = vi.fn(),
    handleSelect = vi.fn(),
  } = overrides;

  const t = ((key: string): string => {
    const messages: Record<string, string> = {
      'docs.attachDialog.title': 'Attach Document',
      'docs.attachDialog.description': 'Search for a page to link to this step.',
      'docs.attachDialog.searchPlaceholder': 'Search Notion and Confluence pages...',
      'docs.attachDialog.filterAll': 'All',
      'docs.attachDialog.filterNotion': 'Notion',
      'docs.attachDialog.filterConfluence': 'Confluence',
      'docs.attachDialog.noResults': 'No pages found matching your search.',
    };
    return messages[key] ?? key;
  }) as TranslateFn;

  return {
    open,
    onOpenChange,
    query,
    setQuery,
    debouncedQuery,
    providerFilter,
    setProviderFilter,
    searchQuery: { isLoading: searchLoading, data: results } as never,
    results,
    attachMutation: { isPending: attachPending } as never,
    handleSelect,
    t,
  };
}

describe('AttachDocDialogView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog title when open', () => {
    render(<AttachDocDialogView {...buildProps()} />);
    expect(screen.getByText('Attach Document')).toBeInTheDocument();
  });

  it('renders dialog description', () => {
    render(<AttachDocDialogView {...buildProps()} />);
    expect(screen.getByText('Search for a page to link to this step.')).toBeInTheDocument();
  });

  it('does not render dialog when closed', () => {
    render(<AttachDocDialogView {...buildProps({ open: false })} />);
    expect(screen.queryByText('Attach Document')).not.toBeInTheDocument();
  });

  it('renders the search input with placeholder', () => {
    render(<AttachDocDialogView {...buildProps()} />);
    expect(
      screen.getByPlaceholderText('Search Notion and Confluence pages...'),
    ).toBeInTheDocument();
  });

  it('renders provider filter buttons', () => {
    render(<AttachDocDialogView {...buildProps()} />);
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Notion/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confluence/ })).toBeInTheDocument();
  });

  it('shows the no-results message once a query has been entered with empty results', () => {
    render(
      <AttachDocDialogView {...buildProps({ query: 'xyz', debouncedQuery: 'xyz', results: [] })} />,
    );
    expect(screen.getByText('No pages found matching your search.')).toBeInTheDocument();
  });

  it('renders search results when available', () => {
    render(
      <AttachDocDialogView
        {...buildProps({ query: 'design', debouncedQuery: 'design', results: mockResults })}
      />,
    );
    expect(screen.getByText('Design System')).toBeInTheDocument();
    expect(screen.getByText('API Docs')).toBeInTheDocument();
  });

  it('renders result subtitles', () => {
    render(
      <AttachDocDialogView
        {...buildProps({ query: 'docs', debouncedQuery: 'docs', results: mockResults })}
      />,
    );
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('Docs Space')).toBeInTheDocument();
  });

  it('calls handleSelect when a result is clicked', async () => {
    const handleSelect = vi.fn();
    const { user } = setup(
      <AttachDocDialogView
        {...buildProps({
          query: 'design',
          debouncedQuery: 'design',
          results: mockResults,
          handleSelect,
        })}
      />,
    );
    await user.click(screen.getByText('Design System'));
    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'page-1',
        url: 'https://notion.so/page-1',
        provider: 'notion',
      }),
    );
  });

  it('forwards typed input to setQuery', async () => {
    const setQuery = vi.fn();
    const { user } = setup(<AttachDocDialogView {...buildProps({ setQuery })} />);
    const input = screen.getByPlaceholderText('Search Notion and Confluence pages...');
    await user.type(input, 'a');
    expect(setQuery).toHaveBeenCalled();
  });

  it('forwards filter clicks to setProviderFilter', async () => {
    const setProviderFilter = vi.fn();
    const { user } = setup(<AttachDocDialogView {...buildProps({ setProviderFilter })} />);
    await user.click(screen.getByRole('button', { name: /Notion/ }));
    expect(setProviderFilter).toHaveBeenCalledWith('notion');
  });
});
