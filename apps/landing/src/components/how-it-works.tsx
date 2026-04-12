"use client";

import { Banknote, CheckCircle2, FileSignature, Receipt, UserPlus } from "lucide-react";
import { FadeUp, StaggerContainer, StaggerItem } from "./motion-wrapper";

const steps = [
  {
    number: "01",
    icon: UserPlus,
    title: "Onboard",
    description:
      "Add a contractor, assign a checklist. They self-serve their data, upload docs, and sign contracts via e-sign.",
    accent: "border-teal-400/30 bg-teal-500/5",
    iconColor: "text-teal-500",
    dotColor: "bg-teal-500",
  },
  {
    number: "02",
    icon: FileSignature,
    title: "Contract",
    description:
      "Generate contracts from templates. Automatic renewal tracking, amendment history, and version control.",
    accent: "border-info/30 bg-info/5",
    iconColor: "text-info",
    dotColor: "bg-info",
  },
  {
    number: "03",
    icon: Receipt,
    title: "Invoice",
    description:
      "Invoices pulled from KSeF automatically. Matched to contracts and rate cards. Discrepancies flagged instantly.",
    accent: "border-accent-warm/30 bg-accent-warm/5",
    iconColor: "text-accent-warm",
    dotColor: "bg-accent-warm",
  },
  {
    number: "04",
    icon: CheckCircle2,
    title: "Approve",
    description:
      "Route invoices through your approval chain. Every action logged with timestamp and approver identity.",
    accent: "border-success/30 bg-success/5",
    iconColor: "text-success",
    dotColor: "bg-success",
  },
  {
    number: "05",
    icon: Banknote,
    title: "Pay",
    description:
      "Batch-export approved invoices for payment. Automatic reconciliation when payments clear. Done.",
    accent: "border-primary/30 bg-primary/5",
    iconColor: "text-primary",
    dotColor: "bg-primary",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-28 sm:py-36 overflow-hidden">
      <div className="mx-auto max-w-6xl px-6">
        <FadeUp className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            How it works
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl font-display text-display">
            Five steps from <span className="gradient-text">chaos to control</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Replace six disconnected tools with one unified flow. Each step feeds the next — no
            copy-pasting, no dropped balls.
          </p>
        </FadeUp>

        <StaggerContainer className="relative mt-20" staggerDelay={0.12}>
          {/* Connecting line (desktop) */}
          <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-primary/20 via-accent-warm/15 to-primary/20 hidden lg:block" />

          <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-1 lg:gap-0">
            {steps.map((step, i) => (
              <StaggerItem key={step.number}>
                <div className="group relative flex items-start gap-6 lg:gap-8 py-6 lg:py-8">
                  {/* Timeline dot (desktop) */}
                  <div className="relative z-10 hidden lg:flex flex-col items-center">
                    <div
                      className={`flex h-16 w-16 items-center justify-center rounded-2xl border ${step.accent} transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg`}
                    >
                      <step.icon className={`h-7 w-7 ${step.iconColor}`} />
                    </div>
                  </div>

                  {/* Mobile icon */}
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${step.accent} lg:hidden`}
                  >
                    <step.icon className={`h-5 w-5 ${step.iconColor}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 max-w-xl">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold tracking-wider text-muted-foreground/60">
                        {step.number}
                      </span>
                      <h3 className="font-display text-xl font-bold tracking-tight text-foreground">
                        {step.title}
                      </h3>
                    </div>
                    <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </div>

                  {/* Arrow connector (desktop) */}
                  {i < steps.length - 1 && (
                    <div className="absolute left-[31px] top-[88px] hidden lg:block">
                      <div className="h-8 w-px bg-gradient-to-b from-border to-transparent" />
                    </div>
                  )}
                </div>
              </StaggerItem>
            ))}
          </div>
        </StaggerContainer>
      </div>
    </section>
  );
}
