'use client';

import { ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { FadeUp, StaggerContainer, StaggerItem } from '@/components/motion-wrapper';
import { posthog } from '@/lib/posthog';

const faqs = [
  {
    q: 'Can I start for free?',
    a: 'Yes. The Starter plan is free for up to 5 contractors with no time limit. You get contractor profiles, basic onboarding checklists, invoice tracking, single-step approvals, and a full audit trail. No credit card required.',
  },
  {
    q: 'What happens when my 14-day Pro trial ends?',
    a: 'You\u2019ll be downgraded to the Starter plan automatically \u2014 no charges, no surprises. All your data stays intact. You can upgrade to Pro anytime to re-enable advanced features like KSeF integration and multi-step approvals.',
  },
  {
    q: 'How does per-contractor pricing work?',
    a: 'You\u2019re billed monthly for each active contractor in your system. If a contractor is offboarded or deactivated, they stop counting toward your bill at the next billing cycle. No charge for inactive records.',
  },
  {
    q: 'What are credits and when do I need them?',
    a: 'Credits are consumed by actions that involve third-party integrations or compute: e-signature requests (5 credits), KSeF invoice pulls (1 credit), onboarding flows (3 credits), and batch payment exports (2 credits). The Pro plan includes a monthly credit allowance. Buy extra packs if you need more \u2014 unused credits never expire.',
  },
  {
    q: 'Can I switch between monthly and annual billing?',
    a: 'Yes. You can switch at any time from your billing settings. When switching to annual, you\u2019ll receive a prorated credit for the remainder of your current month. Annual plans save ~20%.',
  },
  {
    q: 'Is my data safe? Where is it stored?',
    a: 'All data is stored in EU data centers (AWS eu-central-1, Frankfurt). We\u2019re GDPR-compliant by design with full data processing agreements available. All communication is encrypted in transit (TLS 1.3) and at rest (AES-256). SOC 2 Type II certification is in progress.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit and debit cards (Visa, Mastercard, American Express) via Stripe. For Enterprise plans, we also support bank transfers and can issue proper VAT invoices through KSeF.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes, no lock-in. Cancel from your billing settings and you\u2019ll retain access until the end of your current billing period. Your data remains accessible for 90 days after cancellation for export.',
  },
  {
    q: 'Do you offer discounts for startups or NGOs?',
    a: 'Yes. We offer 50% off Pro for the first year for startups under 2 years old and registered NGOs. Contact us at hello@contractorops.com with proof of eligibility.',
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  function handleToggle() {
    setOpen(prev => {
      const next = !prev;
      if (next) {
        posthog.capture('faq_opened', { question: q });
      }
      return next;
    });
  }

  return (
    <div className="border-b border-border/30 last:border-b-0">
      <button
        type="button"
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onClick={handleToggle}
        className="flex w-full items-start justify-between gap-4 py-5 text-left transition-colors hover:text-primary"
        aria-expanded={open}>
        <span className="text-sm font-semibold text-foreground sm:text-base">{q}</span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mt-0.5 shrink-0">
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </button>
      <motion.div
        initial={false}
        animate={{
          height: open ? 'auto' : 0,
          opacity: open ? 1 : 0,
        }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden">
        <p className="pb-5 text-sm leading-relaxed text-muted-foreground pr-8">{a}</p>
      </motion.div>
    </div>
  );
}

export function PricingFAQ() {
  return (
    <section className="relative py-28 sm:py-36">
      <div className="mx-auto max-w-3xl px-6">
        <FadeUp className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">FAQ</p>
          <h2 className="mx-auto mt-4 font-display text-display">
            Common <span className="gradient-text">questions</span>
          </h2>
        </FadeUp>

        <StaggerContainer className="mt-14" staggerDelay={0.06}>
          <div className="rounded-2xl border border-border/50 bg-surface-1/60 px-6 sm:px-8 backdrop-blur-sm">
            {faqs.map(faq => (
              <StaggerItem key={faq.q}>
                <FAQItem q={faq.q} a={faq.a} />
              </StaggerItem>
            ))}
          </div>
        </StaggerContainer>

        {/* Contact CTA */}
        <FadeUp className="mt-12 text-center" delay={0.2}>
          <p className="text-sm text-muted-foreground">
            Still have questions?{' '}
            <a
              href="mailto:hello@contractorops.com"
              className="font-medium text-primary underline underline-offset-4 transition-colors hover:text-primary/80">
              Get in touch
            </a>
          </p>
        </FadeUp>
      </div>
    </section>
  );
}
