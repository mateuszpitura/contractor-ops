/**
 * Canonical icon size tokens. Use these instead of ad-hoc `size-3`,
 * `h-4 w-4`, `size-3.5`, etc. to eliminate sub-pixel drift between
 * neighbouring buttons.
 *
 * Convention:
 * - `md` (16px) — default for action buttons, dropdown items, modal
 *   headers, table cell action icons.
 * - `sm` (14px) — inline metadata (badges, breadcrumbs, helper text
 *   adornments). Use sparingly.
 * - `lg` (20px) — large CTAs, empty-state icons in fallback mode, page
 *   header avatars.
 *
 * The values are Tailwind class strings so consumers can just spread
 * them: `<Icon className={iconSize.md} />`.
 */
export const iconSize = {
  sm: 'size-3.5',
  md: 'size-4',
  lg: 'size-5',
} as const;

export type IconSize = keyof typeof iconSize;
