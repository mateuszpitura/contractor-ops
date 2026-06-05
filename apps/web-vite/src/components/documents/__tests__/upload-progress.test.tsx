/**
 * UploadProgress renders one in-flight or finished upload row. It is purely
 * presentational — covers a small status enum and the progress bar.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UploadingFile } from '../upload-progress.js';
import { UploadProgress } from '../upload-progress.js';
import { click, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

function makeFile(name: string, type: string, size = 1024): File {
  return new File(['x'.repeat(size)], name, { type });
}

function baseUpload(overrides: Partial<UploadingFile> = {}): UploadingFile {
  return {
    id: 'upload-1',
    file: makeFile('report.pdf', 'application/pdf', 4096),
    status: 'uploading',
    progress: 25,
    ...overrides,
  };
}

describe('UploadProgress (web-vite)', () => {
  it('renders the filename and a progressbar while uploading', async () => {
    const { container } = await mount(<UploadProgress file={baseUpload()} onRemove={vi.fn()} />);
    expect(container.textContent).toContain('report.pdf');
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it('renders the scan-passed badge when status is clean', async () => {
    const { container } = await mount(
      <UploadProgress file={baseUpload({ status: 'clean' })} onRemove={vi.fn()} />,
    );
    expect(container.textContent).toContain('Scan passed');
  });

  it('renders the infected badge when status is infected', async () => {
    const { container } = await mount(
      <UploadProgress file={baseUpload({ status: 'infected' })} onRemove={vi.fn()} />,
    );
    expect(container.textContent).toContain('Threat detected');
  });

  it('renders the scan-failed badge when status is failed', async () => {
    const { container } = await mount(
      <UploadProgress file={baseUpload({ status: 'failed' })} onRemove={vi.fn()} />,
    );
    expect(container.textContent).toContain('Scan could not complete');
  });

  it('renders the upload-error badge when status is error', async () => {
    const { container } = await mount(
      <UploadProgress file={baseUpload({ status: 'error' })} onRemove={vi.fn()} />,
    );
    expect(container.textContent).toContain('Upload failed');
  });

  it('invokes onRemove when the dismiss button is clicked', async () => {
    const onRemove = vi.fn();
    const { container } = await mount(
      <UploadProgress file={baseUpload({ status: 'clean' })} onRemove={onRemove} />,
    );
    const dismiss = container.querySelector('button');
    expect(dismiss).not.toBeNull();
    await click(dismiss as HTMLButtonElement);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
