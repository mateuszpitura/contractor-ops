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
    // biome-ignore lint/performance/noImgElement: Vite SPA, no next/image — integration brand logo from public/logos/
    <img
      src={src}
      alt={alt}
      width={14}
      height={14}
      loading="lazy"
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

/** Microsoft Entra ID — inline brand mark (four-segment ring, Entra teal). */
export function EntraBrandIcon({ className }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn(base, 'text-[oklch(0.62_0.13_220)]', className)}>
      <path d="M12 2 2 21h4.2L12 9.6 17.8 21H22L12 2Zm0 8.9L7.6 19.4h8.8L12 10.9Z" />
    </svg>
  );
}

/** Okta — inline brand mark (ring, Okta blue). */
export function OktaBrandIcon({ className }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn(base, 'text-[oklch(0.5_0.16_255)]', className)}>
      <path d="M12 5.25a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5Zm0 3.4a3.35 3.35 0 1 1 0 6.7 3.35 3.35 0 0 1 0-6.7Z" />
    </svg>
  );
}

/** GitHub — inline Octocat mark (currentColor; adapts to light/dark). */
export function GitHubBrandIcon({ className }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={cn(base, className)}>
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.21 3.44 9.63 8.2 11.19.6.11.82-.25.82-.56v-2.16c-3.34.71-4.04-1.58-4.04-1.58-.55-1.36-1.34-1.72-1.34-1.72-1.09-.73.08-.72.08-.72 1.2.08 1.84 1.21 1.84 1.21 1.07 1.8 2.81 1.28 3.5.98.11-.76.42-1.28.76-1.58-2.67-.3-5.47-1.31-5.47-5.83 0-1.29.47-2.34 1.24-3.17-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.21a11.6 11.6 0 0 1 3-.4c1.02 0 2.05.13 3 .4 2.29-1.53 3.3-1.21 3.3-1.21.65 1.66.24 2.88.12 3.18.77.83 1.23 1.88 1.23 3.17 0 4.53-2.81 5.53-5.49 5.82.43.37.81 1.1.81 2.22v3.29c0 .31.22.68.83.56A12.01 12.01 0 0 0 24 12.29C24 5.78 18.63.5 12 .5Z" />
    </svg>
  );
}
