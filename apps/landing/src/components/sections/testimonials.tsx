'use client';

import { Marquee } from '@contractor-ops/ui/components/magic/marquee';
import { cn } from '@contractor-ops/ui/lib/utils';
import { Quote } from 'lucide-react';

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
  const firstRow = items.slice(0, half);
  const secondRow = items.slice(half);

  return (
    <section className="relative overflow-hidden py-24">
      <div className="mx-auto mb-12 max-w-2xl px-6 text-center">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-primary">{label}</p>
        <h2 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
          {headline}{' '}
          <span className="bg-gradient-to-r from-primary via-primary/80 to-foreground bg-clip-text text-transparent">
            {headlineHighlight}
          </span>
        </h2>
        <p className="mt-4 text-base text-muted-foreground md:text-lg">{description}</p>
      </div>

      <div className="relative flex flex-col gap-6">
        <Marquee pauseOnHover className="[--duration:70s] [--gap:1.5rem]">
          {firstRow.map(item => (
            <TestimonialCard key={`${item.author}-${item.company}`} item={item} />
          ))}
        </Marquee>
        <Marquee reverse pauseOnHover className="[--duration:85s] [--gap:1.5rem]">
          {secondRow.map(item => (
            <TestimonialCard key={`${item.author}-${item.company}`} item={item} />
          ))}
        </Marquee>
      </div>
    </section>
  );
}

function TestimonialCard({ item }: { item: TestimonialItem }) {
  return (
    <figure
      className={cn(
        'relative flex w-[24rem] max-w-[80vw] flex-col gap-4 rounded-2xl border border-border/50 bg-card/70 p-6 backdrop-blur',
        'transition-colors hover:border-primary/40',
      )}>
      <Quote aria-hidden className="size-5 text-primary/70" />
      <blockquote className="text-base leading-relaxed text-foreground/90">
        "{item.quote}"
      </blockquote>
      <figcaption className="mt-2 flex flex-col">
        <span className="text-sm font-semibold text-foreground">{item.author}</span>
        <span className="text-xs text-muted-foreground">
          {item.role} · {item.company}
        </span>
      </figcaption>
    </figure>
  );
}
