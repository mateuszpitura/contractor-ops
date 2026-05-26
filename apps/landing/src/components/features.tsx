'use client';

import { ShiftCard } from '@contractor-ops/ui/components/cult';
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
import { FadeUp, StaggerContainer, StaggerItem } from './motion-wrapper';

const features = [
  {
    icon: FileText,
    title: 'Contracts & docs',
    description:
      'Template-driven contracts with e-sign, version tracking, and automatic renewal alerts. Every document linked to the contractor profile.',
    span: 'col-span-1',
    accent: 'from-teal-500/10 to-teal-600/5',
    iconBg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  },
  {
    icon: UserPlus,
    title: 'Automated onboarding',
    description:
      'Configurable checklists with ownership, deadlines, and compliance gates. Contractors self-serve. You just approve.',
    span: 'col-span-1',
    accent: 'from-info/10 to-info/5',
    iconBg: 'bg-info/10 text-info',
  },
  {
    icon: Receipt,
    title: 'KSeF invoice matching',
    description:
      'Auto-pull invoices from KSeF, match to contracts and rates, flag discrepancies. No more hunting through email.',
    span: 'sm:col-span-2 lg:col-span-1',
    accent: 'from-accent-warm/10 to-accent-warm/5',
    iconBg: 'bg-accent-warm/10 text-accent-warm-foreground dark:text-accent-warm',
  },
  {
    icon: CheckCircle2,
    title: 'Approval workflows',
    description:
      "Multi-step approval chains with clear ownership, SLA tracking, and full audit trail. No more 'who approved this?'",
    span: 'col-span-1',
    accent: 'from-success/10 to-success/5',
    iconBg: 'bg-success/10 text-success',
  },
  {
    icon: Banknote,
    title: 'Batch payments',
    description:
      'Export approved invoices as batch payment files. Reconcile automatically. One click, all contractors paid.',
    span: 'col-span-1',
    accent: 'from-primary/10 to-primary/5',
    iconBg: 'bg-primary/10 text-primary',
  },
  {
    icon: UserMinus,
    title: 'Clean offboarding',
    description:
      'Structured exit flow — NDA sign-off, IP transfer, access revocation checklists. Nothing falls through the cracks.',
    span: 'col-span-1',
    accent: 'from-destructive/8 to-destructive/4',
    iconBg: 'bg-destructive/8 text-destructive',
  },
  {
    icon: Shield,
    title: 'Compliance & audit',
    description:
      'Every action timestamped and attributed. Full audit trail for internal reviews, inspections, and legal requirements.',
    span: 'col-span-1 lg:col-span-1',
    accent: 'from-teal-700/10 to-teal-800/5',
    iconBg: 'bg-teal-700/10 text-teal-700 dark:text-teal-300',
  },
  {
    icon: BarChart3,
    title: 'Spend analytics',
    description:
      'Real-time dashboards showing contractor spend, budget burn rate, and cost breakdowns by team, project, or period.',
    span: 'col-span-1 lg:col-span-1',
    accent: 'from-info/8 to-primary/5',
    iconBg: 'bg-info/10 text-info',
  },
];

export function Features() {
  return (
    // biome-ignore lint/correctness/useUniqueElementIds: anchor target for scroll navigation
    <section id="features" className="relative py-28 sm:py-36 overflow-hidden">
      <div className="relative mx-auto max-w-6xl px-6">
        <FadeUp className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Features</p>
          <h2 className="mx-auto mt-4 max-w-3xl font-display text-display">
            One system for your entire <span className="gradient-text">contractor lifecycle</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            From the first contract signature to the final offboarding checklist. Every step
            tracked, every approval audited, every payment reconciled.
          </p>
        </FadeUp>

        {/* Flagship Cult shift-card — hero-class "Why contractor-ops" preview */}
        <FadeUp className="mt-14 flex justify-center" delay={0.1}>
          <ShiftCard
            className="!w-[280px] md:!w-[320px] !bg-primary text-primary-foreground"
            topContent={
              <div className="flex items-center gap-2 pt-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-foreground/15">
                  <Sparkles aria-hidden className="size-4" />
                </span>
                <span className="text-sm font-semibold">Why contractor-ops</span>
              </div>
            }
            middleContent={
              <p className="px-1 pt-6 text-xs leading-relaxed opacity-90">
                One source of truth across contracts, invoices, approvals, and payments.
              </p>
            }
            topAnimateContent={
              <p className="px-1 pt-2 text-xs font-medium uppercase tracking-[0.18em] opacity-80">
                Hover to expand
              </p>
            }
            bottomContent={
              <ul className="space-y-2 px-1 pb-4 text-xs">
                <li className="flex gap-2">
                  <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
                  Contracts &amp; e-sign in one timeline
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
                  KSeF-native invoice reconciliation
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
                  Approval chains with full audit trail
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
                  Payments orchestrated, not chased
                </li>
              </ul>
            }
          />
        </FadeUp>

        <StaggerContainer
          className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          staggerDelay={0.07}>
          {features.map(feature => (
            <StaggerItem key={feature.title} className={feature.span}>
              <div className="group glass-subtle relative h-full rounded-2xl p-6 transition-all duration-300 hover:border-border hover:shadow-md">
                <div className="relative">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${feature.iconBg}`}>
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold tracking-tight text-foreground">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
