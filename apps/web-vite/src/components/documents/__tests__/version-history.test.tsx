/**
 * After the passthrough-container refactor the variant pick lives in the
 * container; the view now exports four single-path components
 * (`VersionHistoryCollapsedTrigger`, `VersionHistoryLoading`,
 * `VersionHistoryEmpty`, `VersionHistoryList`) plus the legacy
 * `VersionHistoryView` composite for backwards compatibility.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/format/use-date-formatter.js', () => ({
  useDateFormatter: () => ({
    formatDate: (v: unknown) => (typeof v === 'string' ? v : ''),
    formatTime: (v: unknown) => (typeof v === 'string' ? v : ''),
    formatDateTime: (v: unknown) => (typeof v === 'string' ? v : ''),
  }),
}));

import type { VersionHistoryProps, VersionRow } from '../hooks/use-version-history.js';
import {
  VersionHistoryCollapsedTrigger,
  VersionHistoryEmpty,
  VersionHistoryList,
  VersionHistoryLoading,
  VersionHistoryView,
} from '../version-history.js';
import { click, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

const baseVersions: VersionRow[] = [
  { id: 'v2', originalFileName: 'doc.pdf', createdAt: '2026-02-01', status: 'ACTIVE' },
  { id: 'v1', originalFileName: 'doc.pdf', createdAt: '2026-01-01', status: 'SUPERSEDED' },
];

function makeProps(overrides: Partial<VersionHistoryProps> = {}): VersionHistoryProps {
  return {
    expanded: false,
    isLoading: false,
    versions: baseVersions,
    onToggle: vi.fn(),
    onDownloadVersion: vi.fn(),
    ...overrides,
  };
}

describe('VersionHistory variants (web-vite)', () => {
  it('VersionHistoryCollapsedTrigger renders the collapsed disclosure trigger', async () => {
    const { container } = await mount(<VersionHistoryCollapsedTrigger onToggle={vi.fn()} />);
    expect(container.textContent).toContain('View version history');
  });

  it('VersionHistoryCollapsedTrigger invokes onToggle when clicked', async () => {
    const onToggle = vi.fn();
    const { container } = await mount(<VersionHistoryCollapsedTrigger onToggle={onToggle} />);
    const trigger = container.querySelector('button');
    expect(trigger).not.toBeNull();
    await click(trigger as HTMLButtonElement);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('VersionHistoryLoading renders the loading copy', async () => {
    const { container } = await mount(<VersionHistoryLoading onToggle={vi.fn()} />);
    expect(container.textContent).toContain('Loading');
  });

  it('VersionHistoryEmpty renders the "no other versions" copy', async () => {
    const { container } = await mount(<VersionHistoryEmpty onToggle={vi.fn()} />);
    expect(container.textContent).toContain('No other versions');
  });

  it('VersionHistoryList renders one row per version with download buttons', async () => {
    const { container } = await mount(
      <VersionHistoryList versions={baseVersions} onToggle={vi.fn()} onDownloadVersion={vi.fn()} />,
    );
    expect(container.textContent).toContain('Version 2');
    expect(container.textContent).toContain('Version 1');
    expect(container.textContent).toContain('2026-02-01');
    expect(container.textContent).toContain('Superseded');
  });

  it('VersionHistoryList invokes onDownloadVersion with the row id when its button is clicked', async () => {
    const onDownloadVersion = vi.fn();
    const { container } = await mount(
      <VersionHistoryList
        versions={baseVersions}
        onToggle={vi.fn()}
        onDownloadVersion={onDownloadVersion}
      />,
    );
    const downloadButtons = Array.from(container.querySelectorAll('button')).filter(b =>
      (b.textContent ?? '').includes('Download'),
    );
    expect(downloadButtons.length).toBe(2);
    await click(downloadButtons[1]);
    expect(onDownloadVersion).toHaveBeenCalledWith('v1');
  });
});

describe('VersionHistoryView legacy composite (web-vite)', () => {
  it('renders the collapsed trigger when not expanded', async () => {
    const { container } = await mount(<VersionHistoryView {...makeProps()} />);
    expect(container.textContent).toContain('View version history');
  });

  it('renders the loading copy when expanded + isLoading', async () => {
    const { container } = await mount(
      <VersionHistoryView {...makeProps({ expanded: true, isLoading: true, versions: [] })} />,
    );
    expect(container.textContent).toContain('Loading');
  });

  it('renders the "no other versions" copy when expanded with only one version', async () => {
    const { container } = await mount(
      <VersionHistoryView {...makeProps({ expanded: true, versions: [baseVersions[0]] })} />,
    );
    expect(container.textContent).toContain('No other versions');
  });

  it('renders one row per version when expanded with multiple versions', async () => {
    const { container } = await mount(<VersionHistoryView {...makeProps({ expanded: true })} />);
    expect(container.textContent).toContain('Version 2');
    expect(container.textContent).toContain('Version 1');
  });
});
