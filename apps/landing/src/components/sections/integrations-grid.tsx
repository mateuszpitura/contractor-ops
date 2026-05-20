'use client';

import { GlowingEffect } from '@contractor-ops/ui/components/ace/glowing-effect';
import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  Building2,
  CheckCircle2,
  CircuitBoard,
  CreditCard,
  Globe2,
  MessageSquare,
  Receipt,
} from 'lucide-react';

interface IntegrationItem {
  name: string;
  category: string;
  description: string;
}

interface IntegrationsGridProps {
  label: string;
  headline: string;
  headlineHighlight: string;
  description: string;
  items: readonly IntegrationItem[];
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Payments: CreditCard,
  Banking: Banknote,
  Accounting: Building2,
  'E-invoicing': Receipt,
  Communication: MessageSquare,
  Compliance: CheckCircle2,
  Identity: CircuitBoard,
  Other: Globe2,
};

export function IntegrationsGrid({
  label,
  headline,
  headlineHighlight,
  description,
  items,
}: IntegrationsGridProps) {
  return (
    <section id="integrations" className="relative py-24">
      <div className="mx-auto max-w-6xl px-6">
        <header className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-primary">
            {label}
          </p>
          <h2 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            {headline}{' '}
            <span className="bg-gradient-to-r from-primary via-primary/80 to-foreground bg-clip-text text-transparent">
              {headlineHighlight}
            </span>
          </h2>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">{description}</p>
        </header>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(item => {
            const Icon = CATEGORY_ICONS[item.category] ?? Globe2;
            return (
              <li
                key={item.name}
                className="group relative isolate overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur transition-colors hover:border-primary/40">
                <GlowingEffect
                  spread={24}
                  glow={true}
                  proximity={36}
                  inactiveZone={0.3}
                  disabled={false}
                />
                <div className="flex items-start gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <div className="flex flex-col">
                    <p className="text-base font-semibold text-foreground">{item.name}</p>
                    <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {item.category}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
