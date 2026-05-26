'use client';

import { InfiniteMovingCards } from '@contractor-ops/ui/components/ace/infinite-moving-cards';

interface TestimonialItem {
  quote: string;
  author: string;
  role: string;
  company: string;
}

interface TestimonialsProps {
  label: string;
  headline: string;
  headlineHighlight: string;
  description: string;
  items: readonly TestimonialItem[];
}

export function Testimonials({
  label,
  headline,
  headlineHighlight,
  description,
  items,
}: TestimonialsProps) {
  const half = Math.ceil(items.length / 2);
  const firstRow = items.slice(0, half).map(toCardItem);
  const secondRow = items.slice(half).map(toCardItem);

  return (
    <section className="relative overflow-hidden py-24">
      <div className="mx-auto mb-12 max-w-2xl px-6 text-center">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-primary">{label}</p>
        <h2 className="text-balance font-display text-display">
          {headline}{' '}
          <span className="bg-gradient-to-r from-primary via-primary/80 to-foreground bg-clip-text text-transparent">
            {headlineHighlight}
          </span>
        </h2>
        <p className="mt-4 text-base text-muted-foreground md:text-lg">{description}</p>
      </div>

      <div className="relative flex flex-col gap-6">
        <InfiniteMovingCards items={firstRow} direction="left" speed="slow" pauseOnHover />
        <InfiniteMovingCards items={secondRow} direction="right" speed="slow" pauseOnHover />
      </div>
    </section>
  );
}

function toCardItem(item: TestimonialItem) {
  return {
    quote: item.quote,
    name: item.author,
    title: `${item.role} · ${item.company}`,
  };
}
