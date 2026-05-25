/**
 * Web-vite port of apps/web/src/components/zatca/__tests__/zatca-compliance-widget.test.tsx.
 *
 * ZatcaComplianceWidgetView is pure presentational; the stats query lives
 * in `useZatcaComplianceWidget`. The test passes shaped props directly.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { useTranslations } from '../../../i18n/useTranslations';

import {
  ZatcaComplianceWidgetSkeleton,
  ZatcaComplianceWidgetView,
} from '../zatca-compliance-widget';

type ViewProps = React.ComponentProps<typeof ZatcaComplianceWidgetView>;

interface Overrides {
  connectionStatus?: string;
  environment?: string;
  certificateExpiresAt?: string;
  expiryDays?: number | null;
  expiryColor?: string;
  stats?: ViewProps['stats'];
  healthPercent?: number;
}

function Harness(props: Overrides) {
  const t = useTranslations('Zatca.complianceWidget');
  return (
    <ZatcaComplianceWidgetView
      connectionStatus={props.connectionStatus ?? 'production'}
      environment={props.environment ?? 'Production'}
      certificateExpiresAt={props.certificateExpiresAt}
      expiryDays={props.expiryDays ?? null}
      expiryColor={props.expiryColor ?? 'text-muted-foreground'}
      stats={
        props.stats ?? {
          total: 100,
          cleared: 80,
          reported: 10,
          pending: 5,
          rejected: 5,
          warning: 0,
        }
      }
      healthPercent={props.healthPercent ?? 90}
      t={t}
    />
  );
}

describe('ZatcaComplianceWidget (web-vite)', () => {
  it('renders loading skeleton sibling', () => {
    const { container } = render(<ZatcaComplianceWidgetSkeleton />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders card title and connection status', () => {
    render(<Harness />);
    expect(screen.getByText('ZATCA (Saudi Arabia)')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('renders period stats with invoice counts', () => {
    render(<Harness />);
    expect(screen.getByText('This Period')).toBeInTheDocument();
    expect(screen.getByText('80 invoices')).toBeInTheDocument();
    expect(screen.getByText('10 invoices')).toBeInTheDocument();
    expect(screen.getAllByText('5 invoices')).toHaveLength(2);
  });

  it('renders health percentage', () => {
    render(<Harness />);
    expect(screen.getByText('Health:')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('renders certificate expiry warning when expiryDays < 30', () => {
    const soon = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
    render(<Harness certificateExpiresAt={soon} expiryDays={15} />);
    expect(screen.getByText(/Certificate expires:/)).toBeInTheDocument();
    expect(screen.getByText(/Renew to avoid submission disruption/)).toBeInTheDocument();
  });

  it('shows 100% health when no submissions exist', () => {
    render(
      <Harness
        stats={{ total: 0, cleared: 0, reported: 0, pending: 0, rejected: 0, warning: 0 }}
        healthPercent={100}
      />,
    );
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
