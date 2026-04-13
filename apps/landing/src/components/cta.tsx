'use client';

import { ArrowRight } from 'lucide-react';
import { FadeUp } from './motion-wrapper';

export function CTA() {
  return (
    <section id="cta" className="relative py-28 sm:py-36 overflow-hidden">
      {/* Single subtle orb for depth */}
      <div className="orb orb-teal absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] opacity-40" />

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <FadeUp>
          <div className="rounded-3xl border border-border/50 bg-surface-1 p-10 sm:p-16 shadow-lg">
            <h2 className="font-display text-display">
              Ready to take <span className="gradient-text">control</span>?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
              Join companies that replaced spreadsheet chaos with a single system for their entire
              contractor lifecycle. Free for up to 5 contractors.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="#cta"
                className="group inline-flex items-center gap-2.5 rounded-2xl bg-primary px-10 py-4 text-base font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl active:scale-[0.98]">
                Start your free trial
                <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href="#cta"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground underline underline-offset-4">
                Book a demo instead
              </a>
            </div>

            <p className="mt-6 text-xs text-muted-foreground/70">
              No credit card required &middot; 14-day Pro trial &middot; Cancel anytime
            </p>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
