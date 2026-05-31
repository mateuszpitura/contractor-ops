'use client';

import {
  Banknote,
  BarChart3,
  CheckCircle2,
  FileText,
  Receipt,
  Shield,
  Sparkles,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { useTranslations } from '@/i18n';
import { FadeUp, StaggerContainer, StaggerItem } from './motion-wrapper';

const featureIcons = {
  contracts: FileText,
  onboarding: UserPlus,
  invoices: Receipt,
  approvals: CheckCircle2,
  payments: Banknote,
  offboarding: UserMinus,
  compliance: Shield,
  analytics: BarChart3,
} as const;

const featureSpans: Record<keyof typeof featureIcons, string> = {
  contracts: 'col-span-1',
  onboarding: 'col-span-1',
  invoices: 'sm:col-span-2 lg:col-span-1',
  approvals: 'col-span-1',
  payments: 'col-span-1',
  offboarding: 'col-span-1',
  compliance: 'col-span-1 lg:col-span-1',
  analytics: 'col-span-1 lg:col-span-1',
};

const featureAccents: Record<keyof typeof featureIcons, { accent: string; iconBg: string }> = {
  contracts: {
    accent: 'from-teal-500/10 to-teal-600/5',
    iconBg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  },
  onboarding: {
    accent: 'from-info/10 to-info/5',
    iconBg: 'bg-info/10 text-info',
  },
  invoices: {
    accent: 'from-accent-warm/10 to-accent-warm/5',
    iconBg: 'bg-accent-warm/10 text-accent-warm-foreground dark:text-accent-warm',
  },
  approvals: {
    accent: 'from-success/10 to-success/5',
    iconBg: 'bg-success/10 text-success',
  },
  payments: {
    accent: 'from-primary/10 to-primary/5',
    iconBg: 'bg-primary/10 text-primary',
  },
  offboarding: {
    accent: 'from-destructive/8 to-destructive/4',
    iconBg: 'bg-destructive/8 text-destructive',
  },
  compliance: {
    accent: 'from-teal-700/10 to-teal-800/5',
    iconBg: 'bg-teal-700/10 text-teal-700 dark:text-teal-300',
  },
  analytics: {
    accent: 'from-info/8 to-primary/5',
    iconBg: 'bg-info/10 text-info',
  },
};

export function Features() {
  const t = useTranslations();
  const featureKeys = Object.keys(featureIcons) as Array<keyof typeof featureIcons>;

  return (
    // biome-ignore lint/correctness/useUniqueElementIds: anchor target for scroll navigation
    <section id="features" className="relative overflow-hidden py-28 sm:py-36">
      <div className="relative mx-auto max-w-6xl px-6">
        <FadeUp className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            {t.features.label}
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl font-display text-display">
            {t.features.headline}{' '}
            <span className="gradient-text">{t.features.headlineHighlight}</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            {t.features.description}
          </p>
        </FadeUp>

        <FadeUp className="mt-14 flex justify-center" delay={0.1}>
          <div className="w-full max-w-sm rounded-3xl bg-primary p-8 text-primary-foreground shadow-lg">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-foreground/15">
                <Sparkles aria-hidden className="size-4" />
              </span>
              <span className="text-sm font-semibold">{t.features.spotlight.title}</span>
            </div>
            <p className="mt-5 text-sm leading-relaxed opacity-90">
              {t.features.spotlight.summary}
            </p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {t.features.spotlight.bullets.map(bullet => (
                <li key={bullet} className="flex gap-2">
                  <CheckCircle2 className="size-4 shrink-0 opacity-90" aria-hidden />
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        </FadeUp>

        <StaggerContainer
          className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          staggerDelay={0.07}>
          {featureKeys.map(key => {
            const Icon = featureIcons[key];
            const item = t.features.items[key];
            const styles = featureAccents[key];

            return (
              <StaggerItem key={key} className={featureSpans[key]}>
                <div className="group glass-subtle relative h-full rounded-2xl p-6 transition-all duration-300 hover:border-border hover:shadow-md">
                  <div className="relative">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${styles.iconBg}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 font-display text-lg font-semibold tracking-tight text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}
