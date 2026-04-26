import { render, screen } from '@/test/test-utils';
import { PrivacyNoticeDisplay } from '../privacy-notice-display';

const mockNotice = {
  jurisdiction: 'AE' as const,
  legalReference: 'UAE PDPL Article 5',
  controller: {
    name: 'Acme Corp',
    country: 'UAE',
  },
  sections: [
    { title: 'Data Collection', content: 'We collect personal data...' },
    { title: 'Data Retention', content: 'Data is retained for 5 years...' },
  ],
};

describe('PrivacyNoticeDisplay', () => {
  it('renders the privacy notice title', () => {
    render(<PrivacyNoticeDisplay notice={mockNotice} />);
    expect(screen.getByText('Privacy notice')).toBeInTheDocument();
  });

  it('renders UAE PDPL jurisdiction badge for AE', () => {
    render(<PrivacyNoticeDisplay notice={mockNotice} />);
    expect(screen.getByText('UAE PDPL')).toBeInTheDocument();
  });

  it('renders Saudi PDPL jurisdiction badge for SA', () => {
    render(<PrivacyNoticeDisplay notice={{ ...mockNotice, jurisdiction: 'SA' }} />);
    expect(screen.getByText('Saudi PDPL')).toBeInTheDocument();
  });

  it('renders the legal reference', () => {
    render(<PrivacyNoticeDisplay notice={mockNotice} />);
    expect(screen.getByText('UAE PDPL Article 5')).toBeInTheDocument();
  });

  it('renders the controller name and country', () => {
    render(<PrivacyNoticeDisplay notice={mockNotice} />);
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
    expect(screen.getByText(/Acme Corp \(UAE\)/)).toBeInTheDocument();
  });

  it('renders all section titles', () => {
    render(<PrivacyNoticeDisplay notice={mockNotice} />);
    expect(screen.getByText('Data Collection')).toBeInTheDocument();
    expect(screen.getByText('Data Retention')).toBeInTheDocument();
  });

  it('renders expand text for collapsible sections', () => {
    render(<PrivacyNoticeDisplay notice={mockNotice} />);
    const expandTexts = screen.getAllByText('Expand');
    expect(expandTexts).toHaveLength(2);
  });
});
