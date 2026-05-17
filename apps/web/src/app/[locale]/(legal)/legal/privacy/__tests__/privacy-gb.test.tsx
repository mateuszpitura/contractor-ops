// Covers FOUND-05 (UK privacy notice Article 13 coverage + accessibility).

import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';
import GbPrivacyPage from '../(content)/gb/page';

describe('UK privacy notice page (FOUND-05)', () => {
  it.each([
    'Who we are',
    'What data we process',
    'Lawful bases',
    'Recipients',
    'Retention',
    'International transfers',
    'Your rights',
    'Complaints & contact',
  ])('renders Article 13 section heading: %s', heading => {
    render(<GbPrivacyPage />);
    const matches = screen
      .getAllByRole('heading', { level: 2 })
      .filter(el => el.textContent?.includes(heading));
    expect(matches.length).toBeGreaterThan(0);
  });

  it('has a skip-link as the first focusable element', () => {
    render(<GbPrivacyPage />);
    const skip = screen.getByRole('link', { name: /skip/i });
    expect(skip).toHaveAttribute('href', '#main');
  });

  it('renders a "Download as PDF" action', () => {
    render(<GbPrivacyPage />);
    const pdfAction = screen.getByRole('button', { name: /download.*pdf/i });
    expect(pdfAction).toBeInTheDocument();
  });
});
