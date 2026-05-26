import { createRef } from 'react';

import { render, screen } from '@/test/test-utils';
import type { useIntakeUpload } from '../../hooks/use-intake-upload';
import {
  IntakeUploadDialog,
  IntakeUploadDropzone,
  IntakeUploadErrorBlock,
} from '../intake-upload-dialog';

type UploadShape = ReturnType<typeof useIntakeUpload>;

function makeUpload(overrides: Partial<UploadShape> = {}): UploadShape {
  return {
    fileInputRef: createRef<HTMLInputElement | null>(),
    isDragOver: false,
    setIsDragOver: vi.fn(),
    localError: null,
    isPending: false,
    handleReset: vi.fn(),
    handleClose: vi.fn(),
    handleDrop: vi.fn(),
    handleChange: vi.fn(),
    ...overrides,
  } as UploadShape;
}

describe('IntakeUploadDialog', () => {
  it('renders the drop-zone with a file input wired to id=intake-upload-input', () => {
    const upload = makeUpload();
    render(
      <IntakeUploadDialog open upload={upload} body={<IntakeUploadDropzone upload={upload} />} />,
    );
    const input = document.getElementById('intake-upload-input') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input?.type).toBe('file');
    expect(input?.getAttribute('accept')).toContain('.xml');
    expect(input?.getAttribute('accept')).toContain('.pdf');
  });

  it('shows the validating label while isPending is true', () => {
    const upload = makeUpload({ isPending: true });
    render(
      <IntakeUploadDialog open upload={upload} body={<IntakeUploadDropzone upload={upload} />} />,
    );
    expect(screen.getByText(/Validating/i)).toBeInTheDocument();
  });

  it('renders an inline error block when localError.kind is wrongType', () => {
    const upload = makeUpload({ localError: { kind: 'wrongType' } });
    render(
      <IntakeUploadDialog
        open
        upload={upload}
        body={
          <IntakeUploadErrorBlock localError={{ kind: 'wrongType' }} onReset={upload.handleReset} />
        }
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('intake-upload-error-message')).toBeInTheDocument();
  });

  it('renders an inline error block when localError.kind is tooLarge', () => {
    const upload = makeUpload({ localError: { kind: 'tooLarge' } });
    render(
      <IntakeUploadDialog
        open
        upload={upload}
        body={
          <IntakeUploadErrorBlock localError={{ kind: 'tooLarge' }} onReset={upload.handleReset} />
        }
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('exposes the try-another button when an error is shown', () => {
    const upload = makeUpload({ localError: { kind: 'generic' } });
    render(
      <IntakeUploadDialog
        open
        upload={upload}
        body={
          <IntakeUploadErrorBlock localError={{ kind: 'generic' }} onReset={upload.handleReset} />
        }
      />,
    );
    expect(screen.getByRole('button', { name: /try another/i })).toBeInTheDocument();
  });
});
