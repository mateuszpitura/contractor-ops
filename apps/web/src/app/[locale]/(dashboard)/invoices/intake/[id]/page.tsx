import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getServerFlag } from '@/lib/server-flag';
import { getServerApi } from '@/trpc/server';
import { IntakeDetailClient } from './intake-detail-client';

/**
 * Invoice intake detail page — `/invoices/intake/[id]`.
 *
 * Gated behind the `einvoice.import-enabled` feature flag. Falls through
 * to `notFound()` on any of:
 *   - flag off
 *   - id does not match any intake in the caller's organization (tRPC
 *     throws `NOT_FOUND` — cross-org access resolves to 404, never 403,
 *     per Plan 62-05 oracle-free design)
 */

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function IntakeDetailPage({ params }: PageProps) {
  const { id } = await params;

  const flagOn = await getServerFlag('einvoice.import-enabled');
  if (!flagOn) {
    notFound();
  }

  const t = await getTranslations('EInvoice.intake');

  // Initial fetch — if the id doesn't belong to the caller's org the
  // router throws NOT_FOUND which we surface as a Next.js 404.
  let intake: unknown;
  try {
    const api = await getServerApi();
    // tRPC's server caller is untyped at the module boundary here because
    // appRouter is re-exported as a deeply-generic tree; cast once after
    // the call so downstream props stay strongly typed via the client
    // boundary's own shape.
    intake = await (
      api as unknown as {
        invoiceIntake: { getById: (i: { intakeId: string }) => Promise<unknown> };
      }
    ).invoiceIntake.getById({ intakeId: id });
  } catch {
    notFound();
  }

  return <IntakeDetailClient intake={intake as never} pageTitle={t('pageTitle')} />;
}
