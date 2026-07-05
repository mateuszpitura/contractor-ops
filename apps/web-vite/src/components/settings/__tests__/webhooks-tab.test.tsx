/**
 * WebhooksTabView is presentational: it receives the list + row actions from its
 * hooks. The create/delete dialog containers reach into tRPC at mount, so we stub
 * them and pass mock actions — keeping the test on the table/empty/loading branches.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../webhooks/create-webhook-dialog', () => ({
  CreateWebhookDialog: () => null,
}));
vi.mock('../webhooks/delete-webhook-dialog', () => ({
  DeleteWebhookDialog: () => null,
}));

import { render, screen } from '@/test/test-utils';
import { WebhooksTabView, type WebhooksTabViewProps } from '../webhooks-tab';

const tStub = ((key: string) => key) as unknown as WebhooksTabViewProps['t'];

const actionsStub: WebhooksTabViewProps['actions'] = {
  t: tStub,
  rotatedSecret: null,
  clearRotatedSecret: vi.fn(),
  testFire: vi.fn(),
  rotateSecret: vi.fn(),
  testFirePending: false,
  rotatePending: false,
};

type SubList = NonNullable<WebhooksTabViewProps['subscriptions']>;

function buildProps(overrides: Partial<WebhooksTabViewProps> = {}): WebhooksTabViewProps {
  return {
    t: tStub,
    subscriptions: [] as unknown as SubList,
    isLoading: false,
    actions: actionsStub,
    ...overrides,
  } as WebhooksTabViewProps;
}

const sampleSub = {
  id: 'whsub_1',
  url: 'https://api.example.com/webhooks',
  eventFilter: ['invoice.paid', 'contractor.created'],
  includePii: false,
  httpAllowed: false,
  enabled: true,
  lastSuccessAt: null,
  lastFailureAt: null,
} as unknown as SubList[number];

describe('WebhooksTabView', () => {
  it('renders the heading, description and create CTA', () => {
    render(<WebhooksTabView {...buildProps()} />);
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('description')).toBeInTheDocument();
    expect(screen.getAllByText('createButton').length).toBeGreaterThanOrEqual(1);
  });

  it('renders skeleton rows while isLoading is true', () => {
    const { container } = render(<WebhooksTabView {...buildProps({ isLoading: true })} />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders the empty state when no subscriptions exist', () => {
    render(<WebhooksTabView {...buildProps({ subscriptions: [] as unknown as SubList })} />);
    expect(screen.getByText('empty.title')).toBeInTheDocument();
    expect(screen.getByText('empty.description')).toBeInTheDocument();
  });

  it('renders the subscription table with the supplied rows', () => {
    render(<WebhooksTabView {...buildProps({ subscriptions: [sampleSub] as unknown as SubList })} />);
    expect(screen.getByText('https://api.example.com/webhooks')).toBeInTheDocument();
    expect(screen.getByText('status.enabled')).toBeInTheDocument();
  });
});
