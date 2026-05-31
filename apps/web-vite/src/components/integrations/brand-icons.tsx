import { cn } from '../../lib/utils';

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
    <img
      src={src}
      alt={alt}
      width={14}
      height={14}
      aria-hidden="true"
      className={cn(base, 'object-contain', className)}
      draggable={false}
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

/** Linear — inline brand mark (no public asset; previously react-icons/si). */
export function LinearBrandIcon({ className }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn(base, 'text-[oklch(0.58_0.14_290)]', className)}>
      <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
    </svg>
  );
}

export function GoogleCalendarBrandIcon({ className }: BrandIconProps) {
  return <LogoImg src="/logos/google-calendar.svg" alt="" className={className} />;
}

export function NotionBrandIcon({ className }: BrandIconProps) {
  return <LogoImg src="/logos/notion.svg" alt="" className={className} />;
}

export function ConfluenceBrandIcon({ className }: BrandIconProps) {
  return <LogoImg src="/logos/confluence.svg" alt="" className={className} />;
}

export function OutlookCalendarBrandIcon({ className }: BrandIconProps) {
  return <LogoImg src="/logos/microsoft-outlook.svg" alt="" className={className} />;
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
