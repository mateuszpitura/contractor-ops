import { describe, expect, it } from 'vitest';

import { render, screen } from '@/test/test-utils';

import { KsefMetadataSection } from '../ksef-metadata-section';

describe('KsefMetadataSection', () => {
  const fetchedAt = new Date('2026-03-01T12:00:00.000Z');

  it('renders the KSeF portal link with an encoded reference', () => {
    render(
      <KsefMetadataSection
        ksefReference="REF/ABC 123"
        upoReceipt={null}
        fetchedAt={fetchedAt}
        source="KSEF"
      />,
    );

    const link = screen.getByRole('link', { name: /view in ksef/i });
    expect(link).toHaveAttribute('href', 'https://ksef.mf.gov.pl/web/REF%2FABC%20123');
  });

  it('shows the UPO receipt block only when upoReceipt is set', () => {
    const { rerender } = render(
      <KsefMetadataSection
        ksefReference="REF-1"
        upoReceipt={null}
        fetchedAt={fetchedAt}
        source="KSEF"
      />,
    );

    expect(screen.queryByText('UPO Receipt')).not.toBeInTheDocument();

    rerender(
      <KsefMetadataSection
        ksefReference="REF-1"
        upoReceipt="UPO-XYZ-999"
        fetchedAt={fetchedAt}
        source="KSEF"
      />,
    );

    expect(screen.getByText('UPO Receipt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy upo receipt/i })).toBeInTheDocument();
  });

  it('exposes copy for the KSeF reference', () => {
    render(
      <KsefMetadataSection
        ksefReference="KSEF-REF-COPY"
        upoReceipt={null}
        fetchedAt={fetchedAt}
        source="KSEF"
      />,
    );

    expect(screen.getByRole('button', { name: /copy ksef reference/i })).toBeInTheDocument();
  });
});
