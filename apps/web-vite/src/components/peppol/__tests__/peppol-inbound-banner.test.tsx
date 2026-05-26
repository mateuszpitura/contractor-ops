/**
 * Step-10 port — Peppol inbound banner. Plain presentational component;
 * the harness wraps i18n so we assert the real EN strings.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '../../../test/test-utils.js';
import { PeppolInboundBanner } from '../peppol-inbound-banner.js';

describe('PeppolInboundBanner (web-vite)', () => {
  it('renders the inbound banner title and sender participant id', () => {
    render(
      <PeppolInboundBanner
        senderParticipantId="0184:NL123456789"
        senderName="ACME BV"
        documentType="Invoice"
        receivedAt={new Date('2026-04-15T10:00:00Z')}
      />,
    );
    expect(screen.getByText(/Received via Peppol Network/i)).toBeInTheDocument();
    expect(screen.getByText(/0184:NL123456789/)).toBeInTheDocument();
  });

  it('omits the documentType line when not provided', () => {
    render(
      <PeppolInboundBanner
        senderParticipantId="0184:NL000000000"
        senderName=""
        receivedAt={new Date('2026-04-15T10:00:00Z')}
      />,
    );
    expect(screen.queryByText(/Document type:/i)).not.toBeInTheDocument();
  });

  it('renders the documentType label when provided', () => {
    render(
      <PeppolInboundBanner
        senderParticipantId="0184:NL000000000"
        senderName="ACME"
        documentType="CreditNote"
        receivedAt={new Date('2026-04-15T10:00:00Z')}
      />,
    );
    expect(screen.getByText(/CreditNote/)).toBeInTheDocument();
  });
});
