/**
 * Step 10 port of apps/web/src/components/reports/__tests__/export-buttons.test.tsx.
 *
 * Web-vite ExportButtons is unchanged in shape — only the i18n source
 * differs (i18next vs next-intl). Tests stay click-driven; the
 * download-link branch is exercised against the still-exported
 * `downloadBase64File` helper.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadBase64File, ExportButtons } from '../export-buttons.js';
import { click, findAllButtons, findButton, findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ExportButtons (web-vite)', () => {
  const defaultProps = {
    onExportPage: vi.fn(),
    onExportAll: vi.fn(),
    isExporting: false,
  };

  it('renders export page and export all buttons', async () => {
    await mount(<ExportButtons {...defaultProps} />);
    expect(findByText(document.body, 'Export page')).not.toBeNull();
    expect(findByText(document.body, 'Export all')).not.toBeNull();
  });

  it('calls onExportPage when export page is clicked', async () => {
    const onExportPage = vi.fn();
    await mount(<ExportButtons {...defaultProps} onExportPage={onExportPage} />);
    const btn = findButton(document.body, 'Export page');
    expect(btn).not.toBeNull();
    await click(btn as HTMLButtonElement);
    expect(onExportPage).toHaveBeenCalledTimes(1);
  });

  it('calls onExportAll when export all is clicked', async () => {
    const onExportAll = vi.fn();
    await mount(<ExportButtons {...defaultProps} onExportAll={onExportAll} />);
    const btn = findButton(document.body, 'Export all');
    expect(btn).not.toBeNull();
    await click(btn as HTMLButtonElement);
    expect(onExportAll).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons when isExporting is true', async () => {
    await mount(<ExportButtons {...defaultProps} isExporting />);
    const buttons = findAllButtons(document.body);
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    for (const btn of buttons) {
      expect(btn.disabled).toBe(true);
    }
  });

  it('shows icons in buttons', async () => {
    const { container } = await mount(<ExportButtons {...defaultProps} />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  it('shows loading spinners on both buttons when isExporting', async () => {
    const { container } = await mount(<ExportButtons {...defaultProps} isExporting />);
    const spinners = container.querySelectorAll('.animate-spin');
    expect(spinners.length).toBe(2);
  });
});

describe('downloadBase64File (web-vite)', () => {
  it('creates and clicks a download link', () => {
    const mockClick = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: mockClick,
    } as unknown as HTMLAnchorElement);

    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    });

    downloadBase64File(btoa('test-data'), 'report.csv', 'text/csv');

    expect(mockClick).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
});
