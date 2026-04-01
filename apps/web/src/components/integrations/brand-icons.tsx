"use client";

import {
  SiConfluence,
  SiGooglecalendar,
  SiJira,
  SiLinear,
  SiNotion,
  SiSlack,
} from "react-icons/si";
import { PiMicrosoftOutlookLogo } from "react-icons/pi";
import { cn } from "@/lib/utils";

/**
 * Integration brand marks — all from **react-icons**:
 * - `react-icons/si` — Simple Icons (Slack, Google Calendar, Jira, Notion, Confluence)
 * - `react-icons/pi` — Phosphor (`PiMicrosoftOutlookLogo` for Outlook)
 */

interface BrandIconProps {
  className?: string;
}

const base = "h-3.5 w-3.5 shrink-0";

/** Slack hash — Simple Icons; tint: Slack aubergine. */
export function SlackBrandIcon({ className }: BrandIconProps) {
  return (
    <SiSlack
      className={cn(base, "text-[#611f69]", className)}
      aria-hidden
    />
  );
}

/** Jira Software — brand blue. */
export function JiraBrandIcon({ className }: BrandIconProps) {
  return (
    <SiJira className={cn(base, "text-[#0052CC]", className)} aria-hidden />
  );
}

/** Linear — brand purple (oklch 0.58 0.14 290). */
export function LinearBrandIcon({ className }: BrandIconProps) {
  return (
    <SiLinear
      className={cn(base, "text-[oklch(0.58_0.14_290)]", className)}
      aria-hidden
    />
  );
}

/** Google Calendar — Simple Icons glyph; tint: Google blue. */
export function GoogleCalendarBrandIcon({ className }: BrandIconProps) {
  return (
    <SiGooglecalendar
      className={cn(base, "text-[#4285F4]", className)}
      aria-hidden
    />
  );
}

export function NotionBrandIcon({ className }: BrandIconProps) {
  return (
    <SiNotion
      className={cn(base, "text-foreground", className)}
      aria-hidden
    />
  );
}

export function ConfluenceBrandIcon({ className }: BrandIconProps) {
  return (
    <SiConfluence
      className={cn(base, "text-[#172B4D]", className)}
      aria-hidden
    />
  );
}

/** Microsoft Outlook — Phosphor. */
export function OutlookCalendarBrandIcon({ className }: BrandIconProps) {
  return (
    <PiMicrosoftOutlookLogo
      className={cn(base, "text-[#0078D4]", className)}
      aria-hidden
    />
  );
}
