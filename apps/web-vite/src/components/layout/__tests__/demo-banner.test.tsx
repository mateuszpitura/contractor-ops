import { describe, expect, it } from 'vitest';

import { render, screen } from '../../../test/test-utils.js';
import { DemoBanner } from '../demo-banner.js';

describe('DemoBanner', () => {
  it('renders an accessible read-only status with the demo copy (en)', async () => {
    render(<DemoBanner />);
    const status = await screen.findByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent('Demo mode');
    expect(status).toHaveTextContent(/changes won't be saved/i);
  });

  it('renders Arabic copy under the ar locale (RTL)', async () => {
    render(<DemoBanner />, { locale: 'ar' });
    // Locale applies asynchronously; the component re-renders on language
    // change, so wait for the Arabic label rather than asserting eagerly.
    expect(await screen.findByText('وضع تجريبي')).toBeInTheDocument();
  });
});
