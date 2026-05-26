'use client';

import { GlareCard } from '@contractor-ops/ui/components/ace/glare-card';
import { GlowingEffect } from '@contractor-ops/ui/components/ace/glowing-effect';
import { cn } from '@contractor-ops/ui/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { Command, FileText, Gauge, Layers, Scale, Wallet } from 'lucide-react';

interface BentoCardCopy {
  title: string;
  description: string;
}

interface BentoFeaturesProps {
  label: string;
  headline: string;
  headlineHighlight: string;
  description: string;
  cards: {
    command: BentoCardCopy;
    vault: BentoCardCopy;
    throughput: BentoCardCopy;
    audit: BentoCardCopy;
    ledger: BentoCardCopy;
    cadence: BentoCardCopy;
  };
}

interface BentoEntry extends BentoCardCopy {
  id: keyof BentoFeaturesProps['cards'];
  icon: LucideIcon;
  area: string;
  variant: 'glare' | 'panel';
}

export function BentoFeatures({
  label,
  headline,
  headlineHighlight,
  description,
  cards,
}: BentoFeaturesProps) {
  const entries: readonly BentoEntry[] = [
    {
      id: 'command',
      ...cards.command,
      icon: Command,
      area: 'md:col-span-2 md:row-span-2',
      variant: 'glare',
    },
    {
      id: 'vault',
      ...cards.vault,
      icon: FileText,
      area: 'md:col-span-1 md:row-span-1',
      variant: 'panel',
    },
    {
      id: 'throughput',
      ...cards.throughput,
      icon: Gauge,
      area: 'md:col-span-1 md:row-span-1',
      variant: 'panel',
    },
    {
      id: 'audit',
      ...cards.audit,
      icon: Scale,
      area: 'md:col-span-1 md:row-span-2',
      variant: 'panel',
    },
    {
      id: 'ledger',
      ...cards.ledger,
      icon: Layers,
      area: 'md:col-span-1 md:row-span-1',
      variant: 'panel',
    },
    {
      id: 'cadence',
      ...cards.cadence,
      icon: Wallet,
      area: 'md:col-span-1 md:row-span-1',
      variant: 'panel',
    },
  ];

  return (
    <section id="bento" className="relative py-24">
      <div className="mx-auto max-w-6xl px-6">
        <header className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-primary">
            {label}
          </p>
          <h2 className="text-balance font-display text-display">
            {headline}{' '}
            <span className="bg-gradient-to-r from-primary via-primary/80 to-foreground bg-clip-text text-transparent">
              {headlineHighlight}
            </span>
          </h2>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">{description}</p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:auto-rows-[14rem]">
          {entries.map(entry =>
            entry.variant === 'glare' ? (
              <GlareEntry key={entry.id} entry={entry} />
            ) : (
              <PanelEntry key={entry.id} entry={entry} />
            ),
          )}
        </div>
      </div>
    </section>
  );
}

function GlareEntry({ entry }: { entry: BentoEntry }) {
  const Icon = entry.icon;
  return (
    <div className={cn('relative isolate', entry.area)}>
      <GlareCard className="flex h-full flex-col justify-between p-6">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon aria-hidden className="size-5" />
        </span>
        <div>
          <h3 className="text-xl font-semibold text-foreground">{entry.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{entry.description}</p>
        </div>
      </GlareCard>
    </div>
  );
}

function PanelEntry({ entry }: { entry: BentoEntry }) {
  const Icon = entry.icon;
  return (
    <div
      className={cn(
        'group relative isolate overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur',
        entry.area,
      )}>
      <GlowingEffect spread={32} glow={true} disabled={false} proximity={48} inactiveZone={0.2} />
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon aria-hidden className="size-5" />
      </span>
      <h3 className="mt-5 text-lg font-semibold text-foreground">{entry.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{entry.description}</p>
    </div>
  );
}
