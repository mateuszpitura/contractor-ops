"use client";

import {
  AlertTriangle,
  CreditCard,
  FileSpreadsheet,
  FolderOpen,
  Mail,
  MessageSquare,
} from "lucide-react";
import { FadeUp, StaggerContainer, StaggerItem } from "./motion-wrapper";

const painPoints = [
  {
    icon: FileSpreadsheet,
    tool: "Excel / Sheets",
    problem: "Contractor list & rates scattered across multiple spreadsheets nobody owns",
    color: "text-success",
  },
  {
    icon: Mail,
    tool: "Email / Slack",
    problem: "Invoices buried in inboxes — lost, duplicated, or sitting unmatched for weeks",
    color: "text-info",
  },
  {
    icon: MessageSquare,
    tool: "Slack DM",
    problem: '"Who was supposed to approve this?" — no ownership, no audit trail',
    color: "text-accent-warm",
  },
  {
    icon: FolderOpen,
    tool: "Google Drive",
    problem: "Contracts, NDAs and IP docs scattered — nothing linked, nothing enforced",
    color: "text-primary",
  },
  {
    icon: CreditCard,
    tool: "Bank transfers",
    problem: "Manual payments — missed deadlines, duplicate wires, zero reconciliation",
    color: "text-destructive",
  },
  {
    icon: AlertTriangle,
    tool: "Nowhere",
    problem: "Offboarding doesn't exist — access stays open, IP docs never signed",
    color: "text-warning",
  },
];

export function Problem() {
  return (
    <section className="relative py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-6">
        <FadeUp className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">The problem</p>
          <h2 className="mx-auto mt-4 max-w-3xl font-display text-display">
            Your contractor ops live in <span className="gradient-text">six different tools</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Every company with 5-50 B2B contractors knows this pain. You&rsquo;re stitching together
            tools that were never designed to work together.
          </p>
        </FadeUp>

        <StaggerContainer
          className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          staggerDelay={0.08}
        >
          {painPoints.map((item) => (
            <StaggerItem key={item.tool}>
              <div className="rounded-2xl border border-border/60 bg-surface-1 p-6">
                <div className="flex items-start gap-4">
                  <div
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/60 ${item.color}`}
                  >
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {item.tool}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">
                      {item.problem}
                    </p>
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
