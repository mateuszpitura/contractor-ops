// Portal upload-replacement form + home banner tests. The DropZone is stubbed
// to a file input so the form test focuses on auto-fill + submit; the banner
// test mocks the portal compliance hook to drive the attention-items branch.

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { applyLocale, initI18n } from '../../../../i18n/index.js';
import { mount } from './_render.js';

// Stub the DropZone to a plain file input so we can drive file selection.
vi.mock('../../../documents/drop-zone.js', () => ({
  DropZone: ({ onFilesAccepted }: { onFilesAccepted?: (f: File[]) => void }) => (
    <input
      type="file"
      data-testid="dropzone"
      onChange={e => {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (f) onFilesAccepted?.([f]);
      }}
    />
  ),
}));
// useComplDocName reads i18n + the validators registry — stub to a stable label.
vi.mock('../../../compliance/hooks/use-compl-doc-name.js', () => ({
  useComplDocName: () => ({ label: 'UK Right-to-Work Share Code', isPending: true }),
}));
vi.mock('../../../../i18n/navigation.js', () => ({
  Link: ({ children }: { children?: unknown }) => children,
}));

const usePortalComplianceMock = vi.fn();
vi.mock('../hooks/use-portal-compliance.js', () => ({
  usePortalCompliance: () => usePortalComplianceMock(),
}));

import { PortalHomeComplianceBanner } from '../../portal-home-compliance-banner.js';
import { PortalUploadReplacementForm } from '../portal-upload-replacement-form.js';

beforeAll(async () => {
  initI18n();
  await applyLocale('en');
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('portal-compliance-upload-replacement render', () => {
  it('exports a PortalUploadReplacementForm view', () => {
    expect(typeof PortalUploadReplacementForm).toBe('function');
  });

  it('auto-fills the expiresAt input from the computed default and lets the contractor edit it', async () => {
    const onSubmit = vi.fn();
    const { container } = await mount(
      <PortalUploadReplacementForm
        itemId="item_1"
        documentLabel="UK Right-to-Work Share Code"
        defaultExpiresAt="2026-07-26"
        isSubmitting={false}
        onSubmit={onSubmit}
      />,
    );
    const dateInput = container.querySelector<HTMLInputElement>('#upload-expires-at');
    expect(dateInput?.value).toBe('2026-07-26');
    const { act } = await import('react');
    await act(async () => {
      if (dateInput) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set;
        setter?.call(dateInput, '2027-01-01');
        dateInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    expect(container.querySelector<HTMLInputElement>('#upload-expires-at')?.value).toBe(
      '2027-01-01',
    );
  });

  it('disables submit until a file is chosen, then enables it', async () => {
    const onSubmit = vi.fn();
    const { container } = await mount(
      <PortalUploadReplacementForm
        itemId="item_1"
        documentLabel="Doc"
        defaultExpiresAt="2026-07-26"
        isSubmitting={false}
        onSubmit={onSubmit}
      />,
    );
    const submitBtn = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submitBtn?.disabled).toBe(true);
    const fileInput = container.querySelector<HTMLInputElement>('[data-testid="dropzone"]');
    const { act } = await import('react');
    await act(async () => {
      const file = new File(['x'], 'rtw.pdf', { type: 'application/pdf' });
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
      fileInput?.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(
      false,
    );
  });
});

describe('portal-compliance-upload-replacement submit', () => {
  it('invokes onSubmit with the itemId + chosen file + suggestedExpiresAt', async () => {
    const onSubmit = vi.fn();
    const { container } = await mount(
      <PortalUploadReplacementForm
        itemId="item_42"
        documentLabel="Doc"
        defaultExpiresAt="2026-07-26"
        isSubmitting={false}
        onSubmit={onSubmit}
      />,
    );
    const fileInput = container.querySelector<HTMLInputElement>('[data-testid="dropzone"]');
    const { act } = await import('react');
    await act(async () => {
      const file = new File(['x'], 'rtw.pdf', { type: 'application/pdf' });
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
      fileInput?.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      container
        .querySelector<HTMLFormElement>('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'item_42', suggestedExpiresAt: '2026-07-26' }),
    );
  });
});

describe('portal-home-compliance-banner', () => {
  it('exports a PortalHomeComplianceBanner', () => {
    expect(typeof PortalHomeComplianceBanner).toBe('function');
  });

  it('renders an alert when attention items exist', async () => {
    usePortalComplianceMock.mockReturnValue({
      isPending: false,
      error: null,
      attentionItems: [{ id: 'i1', status: 'EXPIRED' }],
    });
    const { container } = await mount(<PortalHomeComplianceBanner />);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('renders nothing when there are no attention items', async () => {
    usePortalComplianceMock.mockReturnValue({ isPending: false, error: null, attentionItems: [] });
    const { container } = await mount(<PortalHomeComplianceBanner />);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
