/**
 * Tailark-style animated FAQ accordion built on Base UI's Accordion.
 *
 * Stands in for `@tailark/faqs-*` since tailark.com returns HTML for
 * every `/r/faqs-*.json` probe (probed 2026-05-26). Layout matches the
 * tailark single-column accordion variant: subtle chevron rotation,
 * smooth height transition, semantic disclosure markup.
 */
'use client';

import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as React from 'react';

import { cn } from '../../lib/utils.js';

export interface TailarkFaqItem {
  id: string;
  question: string;
  answer: React.ReactNode;
}

export interface TailarkFaqsProps {
  items: readonly TailarkFaqItem[];
  className?: string;
  defaultOpenId?: string | null;
}

export function TailarkFaqs({ items, className, defaultOpenId = null }: TailarkFaqsProps) {
  const [openId, setOpenId] = React.useState<string | null>(defaultOpenId);
  const reduced = useReducedMotion();

  return (
    <ul className={cn('mx-auto max-w-3xl divide-y divide-border/60', className)}>
      {items.map(item => {
        const isOpen = openId === item.id;
        return (
          <li key={item.id} className="py-3">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`faq-${item.id}-panel`}
              id={`faq-${item.id}-trigger`}
              onClick={() => setOpenId(isOpen ? null : item.id)}
              className="flex w-full items-center justify-between gap-4 rounded-md px-2 py-3 text-start text-base font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span>{item.question}</span>
              <ChevronDown
                aria-hidden
                className={cn(
                  'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                  isOpen && 'rotate-180',
                )}
              />
            </button>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  key="content"
                  id={`faq-${item.id}-panel`}
                  role="region"
                  aria-labelledby={`faq-${item.id}-trigger`}
                  initial={reduced ? false : { opacity: 0, height: 0 }}
                  animate={
                    reduced ? { opacity: 1, height: 'auto' } : { opacity: 1, height: 'auto' }
                  }
                  exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
                  className="overflow-hidden">
                  <div className="px-2 pb-4 pt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.answer}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
