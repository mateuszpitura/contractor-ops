import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';

import { PeppolInboundBanner } from '../peppol-inbound-banner';

const baseProps = {
  senderParticipantId: '0192:123456789012345',
  senderName: 'Acme Trading LLC',
  receivedAt: new Date('2026-03-15T10:30:00Z'),
};

describe('PeppolInboundBanner', () => {
  it('renders the banner title', () => {
    render(<PeppolInboundBanner {...baseProps} />);
    expect(screen.getByText('Received via Peppol Network')).toBeInTheDocument();
  });

  it('displays sender participant ID and name', () => {
    render(<PeppolInboundBanner {...baseProps} />);
    expect(screen.getByText(/0192:123456789012345/)).toBeInTheDocument();
    expect(screen.getByText(/Acme Trading LLC/)).toBeInTheDocument();
  });

  it('renders document type when provided', () => {
    render(
      <PeppolInboundBanner
        {...baseProps}
        documentType="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
      />,
    );
    expect(
      screen.getByText(/Document type: urn:oasis:names:specification:ubl:schema:xsd:Invoice-2/),
    ).toBeInTheDocument();
  });

  it('does not render document type when omitted', () => {
    render(<PeppolInboundBanner {...baseProps} />);
    expect(screen.queryByText(/Document type:/)).not.toBeInTheDocument();
  });

  it('displays the received date', () => {
    render(<PeppolInboundBanner {...baseProps} />);
    expect(screen.getByText(/Received:/)).toBeInTheDocument();
  });

  it('handles empty sender name gracefully', () => {
    render(<PeppolInboundBanner {...baseProps} senderName="" />);
    // Should show participant ID without parenthesized name
    expect(screen.getByText('From: 0192:123456789012345')).toBeInTheDocument();
  });
});
