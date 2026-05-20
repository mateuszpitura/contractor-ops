'use client';

import { Marquee } from '@contractor-ops/ui/components/magic/marquee';
import { cn } from '@contractor-ops/ui/lib/utils';

const logos = [
  'Helix Studios',
  'Nordweg GmbH',
  'Dunes Procurement',
  'Tributo Logistics',
  'Atelier Labs',
  'Brevet Bureau',
  'Köln Werkstatt',
  'Maris Holdings',
  'Östra Partner',
  'Vega Atelier',
];

interface LogoMarqueeProps {
  title: string;
}

export function LogoMarquee({ title }: LogoMarqueeProps) {
  return (
    <section className="border-y border-border/50 bg-background/50 py-12">
      <p className="mx-auto mb-8 max-w-3xl px-6 text-center text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <div className="relative">
        <Marquee pauseOnHover className="[--duration:60s] [--gap:3rem]">
          {logos.map(name => (
            <LogoBadge key={name} name={name} />
          ))}
        </Marquee>
      </div>
    </section>
  );
}

function LogoBadge({ name }: { name: string }) {
  return (
    <div
      className={cn(
        'flex h-14 min-w-[12rem] items-center justify-center px-6',
        'rounded-xl border border-border/60 bg-card/60 backdrop-blur',
        'text-base font-medium tracking-tight text-foreground/80',
        'transition-colors hover:border-primary/40 hover:text-foreground',
      )}>
      {name}
    </div>
  );
}
