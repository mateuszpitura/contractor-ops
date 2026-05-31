/**
 * Sidebar nav count badge for actionable items (workflows, approvals, time, etc.).
 */

interface NavActionBadgeProps {
  count: number;
  ariaLabel: string;
}

export function NavActionBadge({ count, ariaLabel }: NavActionBadgeProps) {
  if (count === 0) return null;

  return (
    <span
      className="pointer-events-none absolute end-2 top-1/2 flex size-[18px] -translate-y-1/2 items-center justify-center rounded-full bg-destructive text-[10px] font-medium leading-none text-destructive-foreground select-none group-data-[collapsible=icon]:hidden"
      role="status"
      aria-label={ariaLabel}>
      {/* biome-ignore lint/nursery/noLeakedRender: count is intentionally rendered as text, and 0 is handled by early return */}
      {count > 9 ? '9+' : count}
    </span>
  );
}
