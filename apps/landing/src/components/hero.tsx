"use client";

import { ArrowRight, Play } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { AnimatedCounter } from "./animated-counter";

const metrics = [
  { value: 4, suffix: "h", label: "saved per week" },
  { value: 100, suffix: "%", label: "invoice accuracy" },
  { value: 2, suffix: "min", label: "onboarding time" },
];

const dashboardCards = [
  {
    label: "Active contractors",
    val: "34",
    color: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  },
  {
    label: "Pending invoices",
    val: "12",
    color: "bg-accent-warm/10 text-accent-warm-foreground dark:text-accent-warm",
  },
  { label: "Due this week", val: "PLN 47.2k", color: "bg-info/10 text-info" },
];

const dashboardRows = [
  {
    name: "Anna Kowalska",
    status: "Active",
    amount: "PLN 12,500",
    statusColor: "bg-success/15 text-success",
  },
  {
    name: "Tomasz Nowak",
    status: "Pending",
    amount: "PLN 8,900",
    statusColor: "bg-warning/15 text-warning",
  },
  {
    name: "Maria Wisniewska",
    status: "Active",
    amount: "PLN 15,200",
    statusColor: "bg-success/15 text-success",
  },
  {
    name: "Jan Zielinski",
    status: "Review",
    amount: "PLN 6,400",
    statusColor: "bg-info/15 text-info",
  },
];

export function Hero() {
  const reduced = useReducedMotion();
  const t = reduced ? { duration: 0 } : undefined;

  return (
    <section className="hero-mesh noise-overlay relative min-h-[100dvh] flex items-center justify-center pt-20 pb-16 overflow-hidden">
      {/* Floating orbs — restrained to 2, higher blur for subtlety */}
      <div className="orb orb-teal absolute -top-20 -left-32 h-[500px] w-[500px] opacity-70" />
      <div className="orb orb-amber absolute top-40 -right-24 h-[400px] w-[400px] opacity-60" />

      {/* Dot grid pattern */}
      <div className="dot-grid absolute inset-0 opacity-30" aria-hidden="true" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={t ?? { duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          KSeF-ready since April 2026
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 40, filter: "blur(16px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={t ?? { duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-4xl font-display text-hero leading-[1.05] tracking-[-0.035em]"
        >
          Stop managing contractors <br className="hidden sm:block" />
          in <span className="gradient-text">spreadsheets</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={t ?? { duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-6 max-w-2xl text-subhead text-muted-foreground"
        >
          Contracts, invoices, approvals and payments for your B2B contractors &mdash; one system,
          zero chaos. Built for EU companies.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={t ?? { duration: 0.6, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <a
            href="#cta"
            className="group inline-flex items-center gap-2.5 rounded-2xl bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl active:scale-[0.98]"
          >
            Start free trial
            <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
          </a>
          <a
            href="#how-it-works"
            className="group inline-flex items-center gap-2.5 rounded-2xl border border-border bg-surface-1/60 px-8 py-4 text-base font-medium text-foreground backdrop-blur-sm transition-all hover:bg-surface-2 hover:border-border/80"
          >
            <Play className="h-4 w-4 text-primary" />
            See how it works
          </a>
        </motion.div>

        {/* Animated metrics strip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={t ?? { duration: 0.6, delay: 0.85, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 flex flex-wrap items-center justify-center gap-8 sm:gap-14"
        >
          {metrics.map((m) => (
            <div key={m.label} className="flex flex-col items-center">
              <AnimatedCounter
                value={m.value}
                suffix={m.suffix}
                duration={1.8}
                className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
              />
              <span className="mt-1 text-sm text-muted-foreground">{m.label}</span>
            </div>
          ))}
        </motion.div>

        {/* Animated browser mockup */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.92, filter: "blur(12px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          transition={t ?? { duration: 1, delay: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto mt-20 max-w-4xl"
        >
          <div
            className="glass-heavy rounded-2xl border border-border/50 overflow-hidden shadow-xl"
            role="img"
            aria-label="Contractor Ops dashboard showing active contractors, pending invoices, and payment tracking"
          >
            {/* Browser chrome */}
            <div className="flex items-center gap-2 border-b border-border/40 bg-surface-2/50 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-destructive/60" />
                <div className="h-3 w-3 rounded-full bg-warning/60" />
                <div className="h-3 w-3 rounded-full bg-success/60" />
              </div>
              <div className="mx-auto flex h-7 w-64 items-center justify-center rounded-lg bg-muted/50 text-xs text-muted-foreground font-mono">
                app.contractorops.com
              </div>
            </div>

            {/* Dashboard preview — elements stagger in */}
            <div className="relative aspect-[16/9.5] bg-gradient-to-br from-surface-0 to-surface-2 p-6 sm:p-8">
              {/* Metric cards — stagger in */}
              <div className="grid grid-cols-3 gap-4 sm:gap-5 mb-5">
                {dashboardCards.map((card, i) => (
                  <motion.div
                    key={card.label}
                    initial={reduced ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      t ?? { duration: 0.5, delay: 1.6 + i * 0.12, ease: [0.16, 1, 0.3, 1] }
                    }
                    className="rounded-xl border border-border/40 bg-surface-1/80 p-3 sm:p-4 backdrop-blur-sm"
                  >
                    <div className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      {card.label}
                    </div>
                    <div
                      className={`mt-1 text-lg sm:text-2xl font-display font-bold tracking-tight ${card.color}`}
                    >
                      {card.val}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Table rows — stagger in after cards */}
              <div className="space-y-2">
                {dashboardRows.map((row, i) => (
                  <motion.div
                    key={row.name}
                    initial={reduced ? false : { opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={
                      t ?? { duration: 0.45, delay: 2.0 + i * 0.1, ease: [0.16, 1, 0.3, 1] }
                    }
                    className="flex items-center justify-between rounded-lg border border-border/30 bg-surface-1/60 px-3 sm:px-4 py-2 sm:py-2.5 backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] sm:text-xs font-bold text-primary">
                        {row.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-foreground">
                        {row.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] sm:text-xs font-medium ${row.statusColor}`}
                      >
                        {row.status}
                      </span>
                      <span className="text-xs sm:text-sm font-mono font-medium text-foreground/80 hidden sm:block">
                        {row.amount}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Gradient fade at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-surface-0 to-transparent pointer-events-none" />
            </div>
          </div>

          {/* Subtle shadow behind mockup */}
          <div className="absolute -inset-2 -z-10 rounded-3xl bg-primary/4 blur-3xl" />
        </motion.div>
      </div>
    </section>
  );
}
