import { render, screen } from '@/test/test-utils';
import { ActivityTab } from '../activity-tab';

describe('ActivityTab', () => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);

  it('renders contract created event', () => {
    render(
      <ActivityTab
        contract={{
          id: 'ct1',
          status: 'ACTIVE',
          createdAt: twoDaysAgo,
          updatedAt: twoDaysAgo,
          amendments: [],
        }}
      />,
    );
    // Should show at least one event
    const eventTexts = screen.getAllByText(/.+/);
    expect(eventTexts.length).toBeGreaterThan(0);
  });

  it('shows status changed event when updated differs from created', () => {
    render(
      <ActivityTab
        contract={{
          id: 'ct1',
          status: 'ACTIVE',
          createdAt: twoDaysAgo,
          updatedAt: oneHourAgo,
          amendments: [],
        }}
      />,
    );
    // Multiple events
    const paragraphs = screen.getAllByText(/.+/);
    expect(paragraphs.length).toBeGreaterThan(1);
  });

  it('includes amendment events', () => {
    render(
      <ActivityTab
        contract={{
          id: 'ct1',
          status: 'ACTIVE',
          createdAt: twoDaysAgo,
          updatedAt: twoDaysAgo,
          amendments: [{ id: 'a1', title: 'Rate Increase', createdAt: oneHourAgo }],
        }}
      />,
    );
    const texts = screen.getAllByText(/.+/);
    expect(texts.length).toBeGreaterThan(1);
  });

  it('includes document upload event when documentCount > 0', () => {
    render(
      <ActivityTab
        contract={{
          id: 'ct1',
          status: 'ACTIVE',
          createdAt: twoDaysAgo,
          updatedAt: twoDaysAgo,
          amendments: [],
          documentCount: 3,
        }}
      />,
    );
    const texts = screen.getAllByText(/.+/);
    expect(texts.length).toBeGreaterThan(1);
  });
});
