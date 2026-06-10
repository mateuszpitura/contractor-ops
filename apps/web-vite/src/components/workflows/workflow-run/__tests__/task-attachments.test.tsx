/**
 * TaskAttachments is presentational — `useTaskAttachmentsSection` bag drives
 * it. DropZone hits tRPC so we mock it out.
 */

import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../documents/drop-zone.js', () => {
  const React = require('react');
  return {
    DropZoneContainer: () => React.createElement('div', { 'data-testid': 'drop-zone' }),
  };
});

import { click, findButton, findByText, mount } from '../../__tests__/_render.js';
import type { AttachmentRow } from '../../hooks/use-task-attachments-section.js';
import { TaskAttachmentsView } from '../task-attachments.js';

afterEach(() => {
  document.body.innerHTML = '';
});

type Props = ComponentProps<typeof TaskAttachmentsView>;

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    taskRunId: 'task-1',
    documents: [],
    isLoading: false,
    isError: false,
    handleRetry: vi.fn(),
    ...overrides,
  };
}

const sampleAttachment: AttachmentRow = {
  id: 'd1',
  originalFileName: 'contract.pdf',
  mimeType: 'application/pdf',
  fileSizeBytes: 2048,
  virusScanStatus: 'CLEAN',
  createdAt: new Date('2026-04-15'),
  uploadedByUserId: 'u1',
  status: 'READY',
};

describe('TaskAttachments (web-vite)', () => {
  it('renders the section heading', async () => {
    await mount(<TaskAttachmentsView {...makeProps()} />);
    expect(findByText(document.body, /attachments/i)).not.toBeNull();
  });

  it('renders the no-attachments copy when empty', async () => {
    await mount(<TaskAttachmentsView {...makeProps()} />);
    expect(findByText(document.body, /no attachments/i)).not.toBeNull();
  });

  it('renders skeleton placeholders while loading', async () => {
    await mount(<TaskAttachmentsView {...makeProps({ isLoading: true })} />);
    expect(document.body.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it('renders the error fallback + retry CTA when isError', async () => {
    const handleRetry = vi.fn();
    await mount(<TaskAttachmentsView {...makeProps({ isError: true, handleRetry })} />);
    const retry = findButton(document.body, /retry|try again/i);
    expect(retry).not.toBeNull();
    await click(retry as HTMLButtonElement);
    expect(handleRetry).toHaveBeenCalled();
  });

  it('renders one row per attachment with the file name + size', async () => {
    await mount(<TaskAttachmentsView {...makeProps({ documents: [sampleAttachment] })} />);
    expect(findByText(document.body, 'contract.pdf')).not.toBeNull();
    expect(findByText(document.body, /KB/)).not.toBeNull();
  });

  it('shows the upload dropzone after clicking Add attachment', async () => {
    await mount(<TaskAttachmentsView {...makeProps()} />);
    const addBtn = findButton(document.body, /add attachment/i);
    expect(addBtn).not.toBeNull();
    await click(addBtn as HTMLButtonElement);
    expect(document.body.querySelector("[data-testid='drop-zone']")).not.toBeNull();
  });
});
