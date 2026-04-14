import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GdprPrivacyNoticeTemplate } from '../gdpr-privacy-notice-template';

// react-pdf components render to a non-DOM tree; we mock them to render
// standard HTML so we can assert on text content.
vi.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="document">{children}</div>
  ),
  Page: ({ children }: { children: React.ReactNode }) => <div data-testid="page">{children}</div>,
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({
    children,
    render: renderProp,
  }: {
    children?: React.ReactNode;
    render?: (info: { pageNumber: number; totalPages: number }) => string;
  }) =>
    renderProp ? (
      <span>{renderProp({ pageNumber: 1, totalPages: 1 })}</span>
    ) : (
      <span>{children}</span>
    ),
  Image: ({ src }: { src: string }) => <img src={src} alt="" />,
  StyleSheet: { create: (s: unknown) => s },
}));

vi.mock('@contractor-ops/validators', () => ({
  gbPrivacyNotice: {
    legalReference: 'UK GDPR / DPA 2018',
    sections: [
      { title: 'Data Controller', content: 'The controller is...' },
      { title: 'Your Rights', content: 'You have the right...' },
    ],
  },
  dePrivacyNotice: {
    legalReference: 'DSGVO / BDSG',
    sections: [{ title: 'Verantwortlicher', content: 'Der Verantwortliche...' }],
  },
  euPrivacyNotice: {
    legalReference: 'EU GDPR',
    sections: [{ title: 'Controller', content: 'The data controller...' }],
  },
}));

const org = { name: 'Test Org', countryCode: 'GB' };

describe('GdprPrivacyNoticeTemplate', () => {
  it('renders GB privacy notice sections', () => {
    const { getByText } = render(
      <GdprPrivacyNoticeTemplate jurisdiction="GB" organization={org} />,
    );
    expect(getByText('Privacy Notice')).toBeInTheDocument();
    expect(getByText('Data Controller')).toBeInTheDocument();
    expect(getByText('Your Rights')).toBeInTheDocument();
  });

  it('renders DE privacy notice with German title', () => {
    const deOrg = { name: 'DE Org', countryCode: 'DE' };
    const { getByText } = render(
      <GdprPrivacyNoticeTemplate jurisdiction="DE" organization={deOrg} />,
    );
    expect(getByText('Datenschutzerklärung')).toBeInTheDocument();
    expect(getByText('Verantwortlicher')).toBeInTheDocument();
  });

  it('renders organization name and country code', () => {
    const { getByText } = render(
      <GdprPrivacyNoticeTemplate jurisdiction="GB" organization={org} />,
    );
    expect(getByText(/Test Org/)).toBeInTheDocument();
    expect(getByText(/GB/)).toBeInTheDocument();
  });

  it('renders legal reference', () => {
    const { getByText } = render(
      <GdprPrivacyNoticeTemplate jurisdiction="GB" organization={org} />,
    );
    expect(getByText('UK GDPR / DPA 2018')).toBeInTheDocument();
  });

  it('renders EU jurisdiction', () => {
    const euOrg = { name: 'EU Org', countryCode: null };
    const { getByText } = render(
      <GdprPrivacyNoticeTemplate jurisdiction="EU" organization={euOrg} />,
    );
    expect(getByText('Controller')).toBeInTheDocument();
    expect(getByText('EU GDPR')).toBeInTheDocument();
  });
});
