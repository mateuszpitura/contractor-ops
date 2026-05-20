'use client';

import { Star } from 'lucide-react';
import { FadeUp, StaggerContainer, StaggerItem } from './motion-wrapper';

const testimonials = [
  {
    quote:
      'We went from chasing invoices in Slack to having everything matched and approved in minutes. KSeF integration alone saved us 6 hours a week.',
    author: 'Katarzyna M.',
    role: 'Head of Operations',
    company: 'A fintech startup, 28 contractors',
  },
  {
    quote:
      "Offboarding used to be a nightmare — we'd find open access months later. Now it's a checklist that just works. Peace of mind we never had.",
    author: 'Pawel R.',
    role: 'CTO',
    company: 'A SaaS company, 40+ contractors',
  },
  {
    quote:
      'The approval workflow replaced our entire Slack-based system. Every invoice has a clear owner, a clear deadline, and a clear audit trail.',
    author: 'Marta D.',
    role: 'Finance Manager',
    company: 'A consulting firm, 15 contractors',
  },
];

const stats = [
  { value: '92%', label: 'less time on invoice processing' },
  { value: '100%', label: 'audit trail coverage' },
  { value: '< 2min', label: 'average approval time' },
  { value: '0', label: 'missed offboarding steps' },
];

export function SocialProof() {
  return (
    <section className="relative py-28 sm:py-36 overflow-hidden">
      <div className="mx-auto max-w-6xl px-6">
        <FadeUp className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Trusted by teams
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl font-display text-display">
            Teams that switched <span className="gradient-text">never looked back</span>
          </h2>
        </FadeUp>

        {/* Stats strip */}
        <StaggerContainer
          className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4"
          staggerDelay={0.08}>
          {stats.map(stat => (
            <StaggerItem key={stat.label}>
              <div className="rounded-2xl border border-border/40 bg-surface-1 p-5 text-center">
                <div className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {stat.value}
                </div>
                <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{stat.label}</div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Testimonials */}
        <StaggerContainer
          className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3"
          staggerDelay={0.1}>
          {testimonials.map(t => (
            <StaggerItem key={t.author}>
              <div className="flex h-full flex-col rounded-2xl border border-border/50 bg-surface-1 p-6 transition-all duration-300 hover:border-border hover:shadow-sm">
                {/* Stars */}
                <div className="flex gap-0.5">
                  {(['s1', 's2', 's3', 's4', 's5'] as const).map(id => (
                    <Star key={id} className="h-4 w-4 fill-accent-warm text-accent-warm" />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground/85">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <div className="mt-5 border-t border-border/40 pt-4">
                  <p className="text-sm font-semibold text-foreground">{t.author}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.company}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
