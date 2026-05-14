'use client';

import Image from 'next/image';
import { SiLinear } from 'react-icons/si';
import { cn } from '@/lib/utils';

/**
 * Integration brand marks.
 *
 * Brands with SVGs in public/logos/ use `<img>` for crisp rendering.
 * Brands without public assets use custom inline SVG.
 */

interface BrandIconProps {
  className?: string;
}

const base = 'h-3.5 w-3.5 shrink-0';

function LogoImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={14}
      height={14}
      aria-hidden="true"
      className={cn(base, 'object-contain', className)}
      draggable={false}
      unoptimized
    />
  );
}

/* ── public/logos/ brands ───────────────────────────────────────────── */

export function SlackBrandIcon({ className }: BrandIconProps) {
  return <LogoImg src="/logos/slack.svg" alt="Slack" className={className} />;
}

export function JiraBrandIcon({ className }: BrandIconProps) {
  return <LogoImg src="/logos/jira.svg" alt="Jira" className={className} />;
}

export function LinearBrandIcon({ className }: BrandIconProps) {
  return <SiLinear className={cn(base, 'text-[oklch(0.58_0.14_290)]', className)} aria-hidden />;
}

export function GoogleCalendarBrandIcon({ className }: BrandIconProps) {
  return <LogoImg src="/logos/google-calendar.svg" alt="Google Calendar" className={className} />;
}

export function NotionBrandIcon({ className }: BrandIconProps) {
  return <LogoImg src="/logos/notion.svg" alt="Notion" className={className} />;
}

export function ConfluenceBrandIcon({ className }: BrandIconProps) {
  return <LogoImg src="/logos/confluence.svg" alt="Confluence" className={className} />;
}

export function OutlookCalendarBrandIcon({ className }: BrandIconProps) {
  return (
    <LogoImg src="/logos/microsoft-outlook.svg" alt="Microsoft Outlook" className={className} />
  );
}

/** Microsoft Teams — from public/logos/ */
export function TeamsBrandIcon({ className }: BrandIconProps) {
  return <LogoImg src="/logos/microsoft-teams.svg" alt="Microsoft Teams" className={className} />;
}

/** Google Workspace — from public/logos/ (Google "G" mark) */
export function GoogleWorkspaceBrandIcon({ className }: BrandIconProps) {
  return <LogoImg src="/logos/google.svg" alt="Google Workspace" className={className} />;
}

/** DPD — logo on white background (red logo needs light bg in dark mode). */
export function DpdBrandIcon({ className }: BrandIconProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-sm bg-white px-1.5 py-0.5',
        className,
      )}>
      <LogoImg src="/logos/dpd_logo.svg" alt="DPD" className="h-full! w-auto!" />
    </span>
  );
}

/** UPS — from public/logos/ */
export function UpsBrandIcon({ className }: BrandIconProps) {
  return <LogoImg src="/logos/ups.svg" alt="UPS" className={className} />;
}

/** KSeF — eagle on red background (#DC0032). */
export function KsefBrandIcon({ className }: BrandIconProps) {
  return (
    <span
      className={cn(
        base,
        'inline-flex items-center justify-center rounded-sm bg-[#DC0032] p-0.5',
        className,
      )}>
      <LogoImg src="/logos/ksef.svg" alt="KSeF" className="h-full w-full" />
    </span>
  );
}

/** ZATCA — logo on official dark blue background. Wide format. */
export function ZatcaBrandIcon({ className }: BrandIconProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-sm bg-[#1a3668] px-1.5 py-0.5',
        className,
      )}>
      <LogoImg src="/logos/zatca.svg" alt="ZATCA" className="h-full! w-auto!" />
    </span>
  );
}

/** Peppol — from public/logos/ */
export function PeppolBrandIcon({ className }: BrandIconProps) {
  return <LogoImg src="/logos/peppol.svg" alt="Peppol" className={className} />;
}
