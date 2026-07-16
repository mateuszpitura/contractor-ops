import type { Metadata } from 'next';

import { StatusFooterNote, StatusView } from './status-view';

export const metadata: Metadata = {
  title: 'System status — Contractor Ops',
  description:
    'Live operational status for the Contractor Ops API, webhook delivery, and background jobs, plus recent incident history.',
};

export default function StatusPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-16 sm:py-24">
      <header className="mb-10">
        <a
          href="https://contractor-ops.io"
          className="font-display text-lg font-semibold tracking-tight">
          Contractor&nbsp;Ops
        </a>
        <p className="mt-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          System status
        </p>
      </header>

      <StatusView />
      <StatusFooterNote />
    </main>
  );
}
