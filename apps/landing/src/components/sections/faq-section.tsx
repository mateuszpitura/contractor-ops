'use client';

import type { TailarkFaqItem } from '@contractor-ops/ui/components/tailark/faqs';
import { TailarkFaqs } from '@contractor-ops/ui/components/tailark/faqs';

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqSectionProps {
  label: string;
  headline: string;
  headlineHighlight: string;
  description: string;
  items: readonly FaqItem[];
}

export function FaqSection({
  label,
  headline,
  headlineHighlight,
  description,
  items,
}: FaqSectionProps) {
  const tailarkItems: TailarkFaqItem[] = items.map((item, index) => ({
    id: `${index}-${item.question.slice(0, 24)}`,
    question: item.question,
    answer: item.answer,
  }));

  return (
    <section id="faq" className="relative py-24">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 md:grid-cols-[18rem,1fr] md:items-start">
        <header className="md:sticky md:top-28">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-primary">
            {label}
          </p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            {headline}{' '}
            <span className="bg-gradient-to-r from-primary via-primary/80 to-foreground bg-clip-text text-transparent">
              {headlineHighlight}
            </span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">{description}</p>
        </header>

        <TailarkFaqs items={tailarkItems} defaultOpenId={tailarkItems[0]?.id ?? null} />
      </div>
    </section>
  );
}
