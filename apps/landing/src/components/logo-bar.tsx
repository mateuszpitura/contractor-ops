"use client";

import { FadeUp } from "./motion-wrapper";

/**
 * Trusted-by logo bar — placed right after the hero.
 * Uses placeholder SVG logos styled to match the design system.
 * Replace with real client logos when available.
 */

const logos = [
  { name: "TechFlow", width: 110 },
  { name: "Novacore", width: 105 },
  { name: "Meridian", width: 115 },
  { name: "Zentara", width: 100 },
  { name: "Arcwise", width: 95 },
  { name: "Luminos", width: 108 },
];

function PlaceholderLogo({ name, width }: { name: string; width: number }) {
  return (
    <div
      className="flex items-center gap-2 opacity-40 transition-opacity duration-300 hover:opacity-70 dark:opacity-30 dark:hover:opacity-50"
      style={{ width }}
    >
      {/* Abstract mark */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5 shrink-0 text-foreground"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="9" cy="12" r="2.5" fill="currentColor" opacity="0.6" />
        <path
          d="M14 9l3 3-3 3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-sm font-semibold tracking-tight text-foreground whitespace-nowrap">
        {name}
      </span>
    </div>
  );
}

export function LogoBar() {
  return (
    <section className="relative py-12 sm:py-16 overflow-hidden">
      <FadeUp delay={0.1}>
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-8">
            Trusted by teams across the EU
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 sm:gap-x-14">
            {logos.map((logo) => (
              <PlaceholderLogo key={logo.name} name={logo.name} width={logo.width} />
            ))}
          </div>
        </div>
      </FadeUp>
    </section>
  );
}
