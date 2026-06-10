// PTO-aware manager fallback routing.
//
// Implements the layered detection rule:
//
//   1. Manual override (highest priority): User.outOfOffice has a date range
//      covering "today in contractor jurisdiction TZ" → PTO active.
//   2. Calendar all-day busy: getFreeBusy returns an all-day busy range
//      covering today → PTO active.
//   3. Calendar timed busy with PTO_KEYWORDS title match: getFreeBusy returns
//      a busy range whose summary matches one of PTO_KEYWORDS for the manager's
//      locale → PTO active.
//
// Fallback chain (when PTO active OR manager is unavailable):
//   A. User.outOfOffice.fallbackUserId (from manager's setting)
//   B. Team.fallbackApproverId (from contractor's team)
//   C. Owner-role users (returns first owner; admin-attention badge in UI)
//
// Resolution runs ONCE at task creation time (not per-render).

import type { PrismaClient } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import type { SupportedLocale } from '@contractor-ops/offboarding-templates';
import { PTO_KEYWORDS } from '@contractor-ops/offboarding-templates';

/**
 * Structural busy-range type compatible with both `GoogleBusyRange` and
 * `OutlookBusyRange` from `@contractor-ops/integrations`. Defined locally so
 * the detector stays calendar-agnostic and isolated from adapter package
 * subpath exports.
 */
export interface BusyRange {
  start: string;
  end: string;
  summary?: string;
  isAllDay?: boolean;
  attendeeCount?: number;
}

const logger = createLogger({ service: 'pto-detector' });

export type PtoFallbackReason = 'manager_pto' | 'no_manager' | 'team_no_fallback';

export interface OutOfOfficeShape {
  from?: string;
  until?: string;
  fallbackUserId?: string;
  reason?: string;
}

/**
 * Duck-typed calendar adapter — any object exposing a `getFreeBusy` method
 * that returns `{ busy: BusyRange[] }` works (Google + Outlook adapters
 * from `@contractor-ops/integrations` both qualify by structure).
 */
export interface CalendarAdapter {
  getFreeBusy(
    accessToken: string,
    args: { calendarId?: string; timeMin: string; timeMax: string },
  ): Promise<{ busy: readonly BusyRange[] }>;
}

export interface ResolveAssigneeWithPtoArgs {
  prisma: PrismaClient;
  organizationId: string;
  managerUserId: string;
  teamId?: string | null;
  /**
   * Locale used to look up `PTO_KEYWORDS` (defaults to 'en' when unknown).
   */
  managerLocale?: SupportedLocale;
  /**
   * Pre-fetched today date in contractor jurisdiction TZ (caller is
   * responsible for using `@date-fns/tz` to construct it). Tests inject
   * a fixed Date to keep determinism.
   */
  today: Date;
  calendarAdapter: CalendarAdapter | null;
  managerCalendarAccessToken?: string;
  managerCalendarId?: string;
  /**
   * Optional list of admin-extended PTO keywords merged with PTO_KEYWORDS
   * for the manager's locale. The Settings UI populates this from the
   * per-org admin extension.
   */
  extraKeywords?: readonly string[];
}

export interface ResolveAssigneeResult {
  assigneeUserId: string;
  fallbackReason?: PtoFallbackReason;
  /**
   * True when the result comes from "owner-role broadcast" leg of the
   * fallback chain — UI surfaces an amber admin-attention badge.
   */
  needsAdminAttention?: boolean;
}

/**
 * Layered PTO check.
 * Returns true if the manager is on PTO today.
 */
export async function isManagerOnPto(
  args: Pick<
    ResolveAssigneeWithPtoArgs,
    | 'prisma'
    | 'managerUserId'
    | 'managerLocale'
    | 'today'
    | 'calendarAdapter'
    | 'managerCalendarAccessToken'
    | 'managerCalendarId'
    | 'extraKeywords'
  >,
): Promise<{ pto: boolean; manualFallbackUserId?: string }> {
  // Layer 1 — manual outOfOffice
  const user = await args.prisma.user.findUnique({
    where: { id: args.managerUserId },
    select: { outOfOffice: true },
  });
  const ooo = user?.outOfOffice as OutOfOfficeShape | null | undefined;
  if (ooo?.from && ooo.until) {
    const from = new Date(ooo.from).getTime();
    const until = new Date(ooo.until).getTime();
    const todayMs = args.today.getTime();
    if (todayMs >= from && todayMs <= until) {
      return { pto: true, manualFallbackUserId: ooo.fallbackUserId };
    }
  }

  // Layer 2 + 3 — calendar
  if (!(args.calendarAdapter && args.managerCalendarAccessToken)) {
    // No calendar integration → skip calendar lookup; only manual OOO applies
    return { pto: false };
  }
  const todayStart = new Date(
    Date.UTC(args.today.getUTCFullYear(), args.today.getUTCMonth(), args.today.getUTCDate()),
  );
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  let busy: readonly BusyRange[] = [];
  try {
    const result = await args.calendarAdapter.getFreeBusy(args.managerCalendarAccessToken, {
      calendarId: args.managerCalendarId,
      timeMin: todayStart.toISOString(),
      timeMax: todayEnd.toISOString(),
    });
    busy = result.busy;
  } catch (err) {
    logger.warn(
      { err, managerUserId: args.managerUserId },
      'getFreeBusy failed — falling back to manager (PTO not detected)',
    );
    return { pto: false };
  }

  // Layer 2 — any all-day busy range covering today
  const hasAllDayBusy = busy.some(b => b.isAllDay);
  if (hasAllDayBusy) {
    return { pto: true };
  }

  // Layer 3 — timed busy with PTO_KEYWORDS title match
  const locale = args.managerLocale ?? 'en';
  const keywords = [...(PTO_KEYWORDS[locale] ?? []), ...(args.extraKeywords ?? [])];
  const lowerKeywords = keywords.map(k => k.toLowerCase());
  const hasKeywordMatch = busy.some(b => {
    if (!b.summary) return false;
    const lower = b.summary.toLowerCase();
    return lowerKeywords.some(k => lower.includes(k.toLowerCase()));
  });
  if (hasKeywordMatch) {
    return { pto: true };
  }

  return { pto: false };
}

/**
 * Resolves the assignee for a KT task. Runs once at task creation time.
 *
 * Returns the manager when no PTO is detected. When PTO is active OR the
 * manager is missing, walks the fallback chain (per-user → per-team → owner role).
 */
export async function resolveAssigneeWithPto(
  args: ResolveAssigneeWithPtoArgs,
): Promise<ResolveAssigneeResult> {
  const ptoCheck = await isManagerOnPto(args);

  if (!ptoCheck.pto) {
    return { assigneeUserId: args.managerUserId };
  }

  // Fallback chain — per-user override wins
  if (ptoCheck.manualFallbackUserId) {
    return { assigneeUserId: ptoCheck.manualFallbackUserId, fallbackReason: 'manager_pto' };
  }

  // Per-team fallback
  if (args.teamId) {
    const team = await args.prisma.team.findUnique({
      where: { id: args.teamId },
      select: { fallbackApproverId: true },
    });
    if (team?.fallbackApproverId) {
      return {
        assigneeUserId: team.fallbackApproverId,
        fallbackReason: 'manager_pto',
      };
    }
  }

  // Last resort — first owner-role member of the org. Triggers admin-attention badge.
  const ownerMember = await args.prisma.member.findFirst({
    where: { organizationId: args.organizationId, role: 'owner' },
    select: { userId: true },
  });
  if (ownerMember) {
    return {
      assigneeUserId: ownerMember.userId,
      fallbackReason: 'team_no_fallback',
      needsAdminAttention: true,
    };
  }

  // Truly nothing — return the manager and surface the admin-attention badge.
  return {
    assigneeUserId: args.managerUserId,
    fallbackReason: 'no_manager',
    needsAdminAttention: true,
  };
}
