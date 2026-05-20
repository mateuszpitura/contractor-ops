'use client';

import { NumberTicker } from '@contractor-ops/ui/components/magic/number-ticker';

interface StatsBandItem {
  value: number;
  suffix: string;
  label: string;
}

interface StatsBandProps {
  label: string;
  items: {
    contractors: StatsBandItem;
    invoicesProcessed: StatsBandItem;
    hoursSaved: StatsBandItem;
    countries: StatsBandItem;
  };
}

export function StatsBand({ label, items }: StatsBandProps) {
  const ordered: readonly StatsBandItem[] = [
    items.contractors,
    items.invoicesProcessed,
    items.hoursSaved,
    items.countries,
  ];

  return (
    <section className="relative border-y border-border/40 bg-gradient-to-b from-background to-background/50 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <p className="mb-12 text-center text-xs font-medium uppercase tracking-[0.22em] text-primary">
          {label}
        </p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
          {ordered.map(item => (
            <div key={item.label} className="flex flex-col-reverse items-center text-center">
              <dt className="mt-3 max-w-[14ch] text-sm leading-snug text-muted-foreground">
                {item.label}
              </dt>
              <dd className="flex items-baseline gap-0.5 text-5xl font-semibold tracking-tight text-foreground tabular-nums md:text-6xl">
                <NumberTicker value={item.value} className="text-foreground" />
                <span aria-hidden className="text-3xl text-foreground/70 md:text-4xl">
                  {item.suffix}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
