'use client';

import { Star } from 'lucide-react';
import { useTranslations } from '@/i18n';
import { FadeUp, StaggerContainer, StaggerItem } from './motion-wrapper';

const statKeys = ['processing', 'auditTrail', 'approvalTime', 'offboarding'] as const;

export function SocialProof() {
  const t = useTranslations();

  return (
    <section className="relative overflow-hidden py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-6">
        <FadeUp className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            {t.socialProof.label}
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl font-display text-display">
            {t.socialProof.headline}{' '}
            <span className="gradient-text">{t.socialProof.headlineHighlight}</span>
          </h2>
        </FadeUp>

        <StaggerContainer
          className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4"
          staggerDelay={0.08}>
          {statKeys.map(key => {
            const stat = t.socialProof.stats[key];
            return (
              <StaggerItem key={key}>
                <div className="rounded-2xl border border-border/40 bg-surface-1 p-5 text-center">
                  <div className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{stat.label}</div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        <StaggerContainer
          className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3"
          staggerDelay={0.1}>
          {t.socialProof.testimonials.map(item => (
            <StaggerItem key={item.author}>
              <div className="flex h-full flex-col rounded-2xl border border-border/50 bg-surface-1 p-6 transition-all duration-300 hover:border-border hover:shadow-sm">
                <div className="flex gap-0.5">
                  {(['s1', 's2', 's3', 's4', 's5'] as const).map(id => (
                    <Star key={id} className="h-4 w-4 fill-accent-warm text-accent-warm" />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground/85">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>
                <div className="mt-5 border-t border-border/40 pt-4">
                  <p className="text-sm font-semibold text-foreground">{item.author}</p>
                  <p className="text-xs text-muted-foreground">{item.role}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.company}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
