/**
 * Web-vite split: presentational `WhtSummaryCard` receives pre-filtered
 * `whtItems` + `totalItemsCount`. The empty-state branch and ID-collection
 * for `onGenerateAll` live in `WhtSummaryCardContainer`, so the view is
 * a single render path — tests pass already-filtered fixtures.
 */

import { render, screen, setup } from '@/test/test-utils';
import type { WhtSummaryItem } from '../wht-summary-card';
import { WhtSummaryCard } from '../wht-summary-card';

const t = (key: string, vars?: Record<string, unknown>) => {
  if (!vars) return key;
  return `${key}:${JSON.stringify(vars)}`;
};

const whtItems: WhtSummaryItem[] = [
  {
    id: 'item-1',
    amountMinor: 100000,
    grossAmountMinor: 100000,
    whtAmountMinor: 15000,
    whtRate: 15,
    whtTreatyApplied: true,
    currency: 'SAR',
  },
  {
    id: 'item-2',
    amountMinor: 50000,
    grossAmountMinor: 50000,
    whtAmountMinor: 7500,
    whtRate: 15,
    whtTreatyApplied: false,
    currency: 'SAR',
  },
];

function renderCard(overrides: Partial<Parameters<typeof WhtSummaryCard>[0]> = {}) {
  const onGenerateAll = vi.fn();
  const result = render(
    <WhtSummaryCard
      t={t}
      locale="en"
      whtItems={whtItems}
      totalItemsCount={3}
      onGenerateAll={onGenerateAll}
      isGenerating={false}
      {...overrides}
    />,
  );
  return { ...result, onGenerateAll };
}

describe('WhtSummaryCard', () => {
  it('renders the card title', () => {
    renderCard();
    expect(screen.getByText('summaryTitle')).toBeInTheDocument();
  });

  it('renders Gross Total, WHT Withheld, and Net Payable labels', () => {
    renderCard();
    expect(screen.getByText('grossTotal')).toBeInTheDocument();
    expect(screen.getByText('whtWithheld')).toBeInTheDocument();
    expect(screen.getByText('netPayable')).toBeInTheDocument();
  });

  it('passes WHT item / total counts to the items-with-wht label', () => {
    renderCard();
    const node = screen.getByText((content: string) => content.startsWith('itemsWithWht:'));
    expect(node.textContent).toContain('"count":2');
    expect(node.textContent).toContain('"total":3');
  });

  it('renders the treaty rates badge with the matching count', () => {
    renderCard();
    const node = screen.getByText((content: string) => content.startsWith('treatyRatesApplied:'));
    expect(node.textContent).toContain('"count":1');
  });

  it('renders the Generate Certificates button', () => {
    renderCard();
    expect(screen.getByRole('button', { name: 'generateCertificates' })).toBeInTheDocument();
  });

  it('invokes onGenerateAll when the action button is clicked', async () => {
    const onGenerateAll = vi.fn();
    const { user, container } = setup(
      <WhtSummaryCard
        t={t}
        locale="en"
        whtItems={whtItems}
        totalItemsCount={3}
        onGenerateAll={onGenerateAll}
        isGenerating={false}
      />,
    );
    const btn = container.querySelector('button');
    expect(btn).toBeTruthy();
    if (btn) await user.click(btn);
    expect(onGenerateAll).toHaveBeenCalledTimes(1);
  });
});
