'use client';

import { Button as MovingBorderButton } from '@contractor-ops/ui/components/ace/moving-border';
import { ArrowRight, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface CtaBandProps {
  label: string;
  headline: string;
  headlineHighlight: string;
  description: string;
  ctaPrimary: string;
  ctaSecondary: string;
  signupHref?: string;
  contactHref?: string;
}

export function CtaBand({
  label,
  headline,
  headlineHighlight,
  description,
  ctaPrimary,
  ctaSecondary,
  signupHref = '/signup',
  contactHref = '/contact',
}: CtaBandProps) {
  const router = useRouter();

  return (
    <section className="relative isolate overflow-hidden py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[40rem] max-w-7xl bg-gradient-to-b from-primary/15 via-transparent to-transparent blur-3xl"
      />
      <div className="mx-auto max-w-3xl px-6 text-center">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.22em] text-primary">{label}</p>
        <h2 className="text-balance text-4xl font-semibold tracking-tight md:text-6xl">
          {headline}{' '}
          <span className="bg-gradient-to-r from-primary via-primary/80 to-foreground bg-clip-text text-transparent">
            {headlineHighlight}
          </span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
          {description}
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <MovingBorderButton
            borderRadius="999px"
            duration={2800}
            containerClassName="h-14 w-auto"
            borderClassName="bg-[radial-gradient(var(--color-primary)_40%,transparent_60%)] opacity-80"
            className="bg-primary px-7 text-primary-foreground border-primary/40 text-base font-semibold gap-2"
            onClick={() => router.push(signupHref)}
            aria-label={ctaPrimary}>
            {ctaPrimary}
            <ArrowRight aria-hidden className="size-4" />
          </MovingBorderButton>

          <Link
            href={contactHref}
            className="inline-flex items-center gap-2 rounded-full border border-border/60 px-6 py-3 text-base font-medium text-foreground/90 backdrop-blur transition-colors hover:border-primary/50 hover:text-foreground">
            <CalendarDays aria-hidden className="size-4" />
            {ctaSecondary}
          </Link>
        </div>
      </div>
    </section>
  );
}
