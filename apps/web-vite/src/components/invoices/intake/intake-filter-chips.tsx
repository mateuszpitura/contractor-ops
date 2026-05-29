import type { KeyboardEvent } from 'react';
import { memo, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRouter } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { cn } from '../../../lib/utils.js';

// ---------------------------------------------------------------------------
// Intake-list filter chips: All / Needs review / Matched / Converted /
// Rejected. Selection writes to `?status=<token>` on the current pathname
// for shareable, back-button-safe state. `All` clears the query param.
// ---------------------------------------------------------------------------

export const INTAKE_FILTERS = ['all', 'needsReview', 'matched', 'converted', 'rejected'] as const;

export type IntakeFilterValue = (typeof INTAKE_FILTERS)[number];

const FILTER_TO_STATUS: Record<Exclude<IntakeFilterValue, 'all'>, string> = {
  needsReview: 'NEEDS_REVIEW',
  matched: 'MATCHED',
  converted: 'CONVERTED',
  rejected: 'REJECTED',
};

const STATUS_TO_FILTER: Record<string, IntakeFilterValue> = {
  NEEDS_REVIEW: 'needsReview',
  MATCHED: 'matched',
  CONVERTED: 'converted',
  REJECTED: 'rejected',
};

const URL_PARAM = 'status';

/**
 * Resolve the currently-selected chip from the URL query string.
 * Unknown values fall back to `all` — defence against tampering (the server
 * re-validates via Zod).
 */
export function parseFilterParam(raw: string | null): IntakeFilterValue {
  if (!raw) return 'all';
  const mapped = STATUS_TO_FILTER[raw];
  return mapped ?? 'all';
}

interface IntakeFilterChipsProps {
  /**
   * Explicit controlled value. When omitted the component reads the chip
   * state from `?status=` in the URL and writes selection back via
   * `router.replace`. Tests pass `value` + `onChange` to bypass the router.
   */
  value?: IntakeFilterValue;
  onChange?: (next: IntakeFilterValue) => void;
}

/**
 * Roving-tabindex button-chip row per WCAG 2.1 § 2.1.1 (keyboard
 * operability) + § 2.4.3 (focus order). ArrowLeft / ArrowRight move focus
 * between chips without selecting; Enter / Space activates.
 */
export function IntakeFilterChips({ value, onChange }: IntakeFilterChipsProps) {
  const t = useTranslations('EInvoice.intake.filter');
  const router = useRouter();
  const [searchParams] = useSearchParams();
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selected = useMemo<IntakeFilterValue>(() => {
    if (value) return value;
    return parseFilterParam(searchParams.get(URL_PARAM));
  }, [value, searchParams]);

  const applyFilter = useCallback(
    (next: IntakeFilterValue) => {
      if (onChange) {
        onChange(next);
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'all') {
        params.delete(URL_PARAM);
      } else {
        params.set(URL_PARAM, FILTER_TO_STATUS[next]);
      }
      const qs = params.toString();
      router.replace(`${window.location.pathname}${qs ? `?${qs}` : ''}`);
    },
    [onChange, router, searchParams],
  );

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const total = INTAKE_FILTERS.length;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (index + delta + total) % total;
      chipRefs.current[nextIndex]?.focus();
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      chipRefs.current[0]?.focus();
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      chipRefs.current[total - 1]?.focus();
    }
  }, []);

  const registerChipRef = useCallback((index: number, el: HTMLButtonElement | null) => {
    chipRefs.current[index] = el;
  }, []);

  return (
    <div
      role="tablist"
      aria-label={t('all')}
      className="flex flex-wrap items-center gap-2"
      data-slot="intake-filter-chips">
      {INTAKE_FILTERS.map((filter, index) => (
        <IntakeFilterChip
          key={filter}
          filter={filter}
          index={index}
          isSelected={filter === selected}
          label={t(filter)}
          onSelect={applyFilter}
          onKeyDown={handleKeyDown}
          registerRef={registerChipRef}
        />
      ))}
    </div>
  );
}

interface IntakeFilterChipProps {
  filter: IntakeFilterValue;
  index: number;
  isSelected: boolean;
  label: string;
  onSelect: (filter: IntakeFilterValue) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  registerRef: (index: number, el: HTMLButtonElement | null) => void;
}

// memo: rendered per chip in intake-filter list
const IntakeFilterChip = memo(function IntakeFilterChip({
  filter,
  index,
  isSelected,
  label,
  onSelect,
  onKeyDown,
  registerRef,
}: IntakeFilterChipProps) {
  const handleRef = useCallback(
    (el: HTMLButtonElement | null) => {
      registerRef(index, el);
    },
    [registerRef, index],
  );

  const handleClick = useCallback(() => {
    onSelect(filter);
  }, [onSelect, filter]);

  const handleKey = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown(event, index);
    },
    [onKeyDown, index],
  );

  return (
    <button
      ref={handleRef}
      type="button"
      role="tab"
      aria-selected={isSelected}
      data-state={isSelected ? 'active' : 'inactive'}
      tabIndex={isSelected ? 0 : -1}
      onClick={handleClick}
      onKeyDown={handleKey}
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isSelected
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-muted/80',
      )}>
      {label}
    </button>
  );
});
