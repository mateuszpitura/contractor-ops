'use client';

import { Clock } from 'lucide-react';
import type { KeyboardEvent, MouseEvent, Ref } from 'react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/utils.js';
import { Button } from './button.js';
import { Popover, PopoverContent, PopoverTrigger } from './popover.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimePickerProps {
  /** Canonical 24-hour value formatted as `HH:mm`. `undefined` shows the placeholder. */
  value: string | undefined;
  /** Receives the canonical 24-hour `HH:mm` regardless of the display `format`. */
  onChange: (next: string) => void;
  /** Display format. Internal/canonical value is always 24h. */
  format?: '24h' | '12h';
  /** Minute step. Must divide cleanly into 60 for the listed options to render canonically. */
  step?: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

type Period = 'AM' | 'PM';
type ColumnKey = 'hour' | 'minute' | 'period';

// ---------------------------------------------------------------------------
// Time helpers — all canonical math runs on 24-hour numbers
// ---------------------------------------------------------------------------

const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);
const HOURS_12 = Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i)); // 12, 1, 2, …, 11

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function clampStep(step: number): number {
  // A step that doesn't divide 60 cleanly will produce non-canonical positions.
  // We accept it but pick a safe floor so we never end up with an empty list.
  const s = Math.floor(step);
  if (s < 1) return 1;
  if (s > 60) return 60;
  return s;
}

function buildMinutes(step: number): number[] {
  const s = clampStep(step);
  const out: number[] = [];
  for (let m = 0; m < 60; m += s) out.push(m);
  return out;
}

/** Parse `HH:mm` → `{ h, m }`. Returns `null` for malformed inputs. */
function parse24(value: string | undefined): { h: number; m: number } | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!(Number.isFinite(h) && Number.isFinite(m))) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

function format24(h: number, m: number): string {
  return `${pad2(((h % 24) + 24) % 24)}:${pad2(((m % 60) + 60) % 60)}`;
}

/** Convert canonical 24h hour → 12-hour clock face + period (`AM`/`PM`). */
function to12(h: number): { hour12: number; period: Period } {
  const period: Period = h < 12 ? 'AM' : 'PM';
  const mod = h % 12;
  const hour12 = mod === 0 ? 12 : mod;
  return { hour12, period };
}

/** Convert a 12-hour face value + period back to canonical 0–23. */
function from12(hour12: number, period: Period): number {
  if (hour12 === 12) return period === 'AM' ? 0 : 12;
  return period === 'AM' ? hour12 : hour12 + 12;
}

/** Trigger label — never abbreviates seconds. */
function formatTriggerLabel(value: string | undefined, fmt: '24h' | '12h'): string | null {
  const parsed = parse24(value);
  if (!parsed) return null;
  if (fmt === '24h') return format24(parsed.h, parsed.m);
  const { hour12, period } = to12(parsed.h);
  return `${pad2(hour12)}:${pad2(parsed.m)} ${period}`;
}

/** Round current time to nearest `step` minutes. Carries into the hour if needed. */
function nowSnappedToStep(step: number): { h: number; m: number } {
  const now = new Date();
  const s = clampStep(step);
  const rawMinutes = now.getHours() * 60 + now.getMinutes();
  const snapped = Math.round(rawMinutes / s) * s;
  const total = ((snapped % (24 * 60)) + 24 * 60) % (24 * 60);
  return { h: Math.floor(total / 60), m: total % 60 };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TimePicker — popover-driven scrollable HH:mm selector (24h or 12h face).
 *
 * Usage:
 *   <TimePicker value={'09:00'} onChange={setValue} format="24h" step={5} />
 *
 *   - `value` / `onChange` are canonical 24-hour `HH:mm` strings regardless
 *     of the `format` prop — display format does not change the wire shape.
 *   - `step` controls the minute column granularity (defaults to 5).
 *
 *   IMPORTANT — popover-trigger parent containers MUST use
 *   `flex flex-col gap-*`, NOT Tailwind's `space-y-*`. Base UI's
 *   `Popover.Trigger` inserts two `position: fixed` `<FocusGuard>` spans
 *   next to the trigger button when the popover opens, which breaks
 *   `space-y-*`'s `:last-child` margin reset and causes a visible
 *   layout shift around the input.
 *
 *   ❌  <div className="space-y-2"><Label/><TimePicker/></div>
 *   ✅  <div className="flex flex-col gap-2"><Label/><TimePicker/></div>
 *
 *   The same rule applies anywhere a `<Popover>` trigger sits in a
 *   labelled form row. For a combined date+time control, prefer
 *   `<DateTimeRangePicker>` instead of stitching `<Calendar>` and
 *   `<TimePicker>` together by hand.
 */
export function TimePicker({
  value,
  onChange,
  format = '24h',
  step = 5,
  disabled,
  placeholder,
  className,
  'aria-label': ariaLabel,
}: TimePickerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [focusedColumn, setFocusedColumn] = useState<ColumnKey>('hour');

  // ── Lists ───────────────────────────────────────────────────────────────
  const hourOptions = useMemo<number[]>(() => (format === '12h' ? HOURS_12 : HOURS_24), [format]);
  const minuteOptions = useMemo<number[]>(() => buildMinutes(step), [step]);

  // ── Refs (for scroll-into-view + programmatic focus) ────────────────────
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);
  const periodListRef = useRef<HTMLDivElement>(null);

  const refByColumn = useCallback(
    (col: ColumnKey) =>
      col === 'hour' ? hourListRef : col === 'minute' ? minuteListRef : periodListRef,
    [],
  );

  // ── Derived "current" parts (defaults snap to noon-ish for a friendly start) ─
  const parsed = parse24(value);
  const currentH = parsed?.h ?? 9;
  const currentM = parsed?.m ?? 0;
  const { hour12: currentHour12, period: currentPeriod } = to12(currentH);

  // ── Commit helpers ──────────────────────────────────────────────────────
  const commit = useCallback(
    (h: number, m: number) => {
      onChange(format24(h, m));
    },
    [onChange],
  );

  const setHour = useCallback(
    (display: number) => {
      const h24 = format === '12h' ? from12(display, currentPeriod) : display;
      commit(h24, currentM);
    },
    [commit, currentM, currentPeriod, format],
  );

  const setMinute = useCallback(
    (m: number) => {
      commit(currentH, m);
    },
    [commit, currentH],
  );

  const setPeriod = useCallback(
    (p: Period) => {
      const next = from12(currentHour12, p);
      commit(next, currentM);
    },
    [commit, currentHour12, currentM],
  );

  // ── Keyboard / arrow nav within the picker surface ──────────────────────
  const stepInColumn = useCallback(
    (col: ColumnKey, delta: 1 | -1) => {
      if (col === 'hour') {
        const list = hourOptions;
        const idx = list.indexOf(format === '12h' ? currentHour12 : currentH);
        const safeIdx = idx === -1 ? 0 : idx;
        const next = list[(safeIdx + delta + list.length) % list.length] ?? list[0]!;
        setHour(next);
        return;
      }
      if (col === 'minute') {
        const list = minuteOptions;
        // Snap to the nearest existing minute, then walk.
        const closest = list.reduce(
          (acc, m) => (Math.abs(m - currentM) < Math.abs(acc - currentM) ? m : acc),
          list[0]!,
        );
        const idx = list.indexOf(closest);
        const next = list[(idx + delta + list.length) % list.length] ?? list[0]!;
        setMinute(next);
        return;
      }
      setPeriod(currentPeriod === 'AM' ? 'PM' : 'AM');
    },
    [
      hourOptions,
      minuteOptions,
      currentH,
      currentHour12,
      currentM,
      currentPeriod,
      format,
      setHour,
      setMinute,
      setPeriod,
    ],
  );

  const focusColumn = useCallback(
    (col: ColumnKey) => {
      setFocusedColumn(col);
      const el = refByColumn(col).current;
      el?.querySelector<HTMLButtonElement>('[data-selected="true"]')?.focus();
    },
    [refByColumn],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const columns: ColumnKey[] =
        format === '12h' ? ['hour', 'minute', 'period'] : ['hour', 'minute'];
      const idx = columns.indexOf(focusedColumn);
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        focusColumn(columns[(idx - 1 + columns.length) % columns.length]!);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        focusColumn(columns[(idx + 1) % columns.length]!);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        stepInColumn(focusedColumn, -1);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        stepInColumn(focusedColumn, 1);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        setOpen(false);
      }
      // Escape is handled by base-ui's Popover natively.
    },
    [focusColumn, focusedColumn, format, stepInColumn],
  );

  // ── Scroll selected option into center on open + on commit ──────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: currentH/currentM are intentional trigger deps — they drive the re-centre on value change
  useEffect(() => {
    if (!open) return;
    // Defer to next frame so the popover finishes mounting + measuring.
    const raf = requestAnimationFrame(() => {
      for (const col of ['hour', 'minute', 'period'] as ColumnKey[]) {
        const container = refByColumn(col).current;
        if (!container) continue;
        const target = container.querySelector<HTMLButtonElement>('[data-selected="true"]');
        if (!target) continue;
        // `scrollIntoView({ block: 'nearest' })` would jitter; manually centre.
        const cMid = container.clientHeight / 2;
        const tTop = target.offsetTop;
        const tMid = target.offsetHeight / 2;
        container.scrollTo({ top: tTop - cMid + tMid, behavior: 'smooth' });
      }
      // Focus the selected option in the currently-focused column so arrows work immediately.
      refByColumn(focusedColumn)
        .current?.querySelector<HTMLButtonElement>('[data-selected="true"]')
        ?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open, focusedColumn, currentH, currentM, refByColumn]);

  // Centre the selected row whenever the value changes while open.
  // biome-ignore lint/correctness/useExhaustiveDependencies: currentH/currentM are intentional trigger deps — they drive the re-centre on value change
  useEffect(() => {
    if (!open) return;
    const container = refByColumn(focusedColumn).current;
    const target = container?.querySelector<HTMLButtonElement>('[data-selected="true"]');
    if (!(container && target)) return;
    const cMid = container.clientHeight / 2;
    container.scrollTo({
      top: target.offsetTop - cMid + target.offsetHeight / 2,
      behavior: 'smooth',
    });
  }, [open, focusedColumn, currentH, currentM, refByColumn]);

  // ── "Now" — snap to current wall clock rounded to the nearest step ──────
  const handleNow = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const snapped = nowSnappedToStep(step);
      commit(snapped.h, snapped.m);
    },
    [commit, step],
  );

  const handleFocusHourColumn = useCallback(() => setFocusedColumn('hour'), []);
  const handleFocusMinuteColumn = useCallback(() => setFocusedColumn('minute'), []);
  const handleFocusPeriodColumn = useCallback(() => setFocusedColumn('period'), []);

  // ── Rendering ───────────────────────────────────────────────────────────
  const triggerLabel = formatTriggerLabel(value, format);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
        render={props => (
          <Button
            {...props}
            id={id}
            type="button"
            variant="outline"
            size="default"
            disabled={disabled}
            aria-haspopup="dialog"
            aria-label={ariaLabel ?? 'Pick a time'}
            className={cn(
              'group/time-trigger w-full justify-start gap-2 font-normal tabular-nums',
              !triggerLabel && 'text-muted-foreground',
              className,
            )}>
            <Clock
              aria-hidden="true"
              className="size-4 text-muted-foreground group-hover/time-trigger:text-foreground/80"
            />
            <span className="truncate">{triggerLabel ?? placeholder ?? '--:--'}</span>
          </Button>
        )}
      />
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-56 p-0 [--time-row-h:--spacing(8)] [--time-list-max:12rem]">
        <div
          role="group"
          aria-label={ariaLabel ?? 'Time picker'}
          onKeyDown={handleKeyDown}
          className="flex flex-col">
          {/* Columns */}
          <div className="flex items-stretch gap-px px-2 pt-2 pb-1">
            <TimeColumn
              ref={hourListRef}
              ariaLabel={format === '12h' ? 'Hour' : 'Hour (24h)'}
              focused={focusedColumn === 'hour'}
              onFocusColumn={handleFocusHourColumn}
              options={hourOptions.map(h => ({
                value: h,
                label: pad2(h),
                selected: format === '12h' ? currentHour12 === h : currentH === h,
                onSelect: () => {
                  setHour(h);
                  setFocusedColumn('hour');
                },
              }))}
            />

            <Separator />

            <TimeColumn
              ref={minuteListRef}
              ariaLabel="Minute"
              focused={focusedColumn === 'minute'}
              onFocusColumn={handleFocusMinuteColumn}
              options={minuteOptions.map(m => ({
                value: m,
                label: pad2(m),
                selected: m === closestMinute(currentM, minuteOptions),
                onSelect: () => {
                  setMinute(m);
                  setFocusedColumn('minute');
                },
              }))}
            />

            {format === '12h' && (
              <>
                <Separator />
                <TimeColumn
                  ref={periodListRef}
                  ariaLabel="AM or PM"
                  focused={focusedColumn === 'period'}
                  onFocusColumn={handleFocusPeriodColumn}
                  options={(['AM', 'PM'] as Period[]).map(p => ({
                    value: p === 'AM' ? 0 : 1,
                    label: p,
                    selected: currentPeriod === p,
                    onSelect: () => {
                      setPeriod(p);
                      setFocusedColumn('period');
                    },
                  }))}
                />
              </>
            )}
          </div>

          {/* Footer — Now + current preview */}
          <div className="flex items-center justify-between gap-2 border-t border-border/60 px-2.5 py-1.5">
            <span
              aria-live="polite"
              className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
              {triggerLabel ?? '--:--'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleNow}
              disabled={disabled}
              className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground">
              Now
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface TimeOption {
  value: number;
  label: string;
  selected: boolean;
  onSelect: () => void;
}

interface TimeColumnProps {
  ariaLabel: string;
  focused: boolean;
  onFocusColumn: () => void;
  options: TimeOption[];
  /** React 19 ref-as-prop — base-ui pattern. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * One vertical scrollable list. The container is a `listbox`; each row is an
 * `option`. We rely on the parent's `onKeyDown` to interpret arrow keys, so
 * each `<button>` has `tabIndex={-1}` except the selected one — that lets
 * `Tab` move you between columns naturally.
 */
function TimeColumn({ ariaLabel, focused, onFocusColumn, options, ref }: TimeColumnProps) {
  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={ariaLabel}
      data-focused={focused}
      onFocus={onFocusColumn}
      className={cn(
        'no-scrollbar relative flex max-h-(--time-list-max) flex-1 flex-col gap-0.5 overflow-y-auto rounded-md scroll-py-1 px-1 py-1 transition-colors',
        'data-[focused=true]:bg-muted/40',
      )}>
      {options.map(option => (
        <button
          key={`${ariaLabel}-${option.value}-${option.label}`}
          type="button"
          role="option"
          aria-selected={option.selected}
          data-selected={option.selected}
          tabIndex={option.selected ? 0 : -1}
          onClick={option.onSelect}
          className={cn(
            'flex h-(--time-row-h) shrink-0 items-center justify-center rounded-md px-2 font-mono text-sm tabular-nums tracking-[0.04em] text-muted-foreground transition-colors outline-none',
            'hover:bg-muted hover:text-foreground',
            'focus-visible:ring-2 focus-visible:ring-ring/50',
            'data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground data-[selected=true]:shadow-sm',
            'data-[selected=true]:hover:bg-primary data-[selected=true]:hover:text-primary-foreground',
          )}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Separator() {
  return (
    <div
      aria-hidden="true"
      className="my-1 w-px shrink-0 bg-gradient-to-b from-transparent via-border to-transparent"
    />
  );
}

/**
 * Find the option closest to the requested minute. Used to highlight the
 * "selected" row even when the value isn't a multiple of `step`.
 */
function closestMinute(target: number, options: number[]): number {
  if (options.length === 0) return target;
  return options.reduce(
    (acc, m) => (Math.abs(m - target) < Math.abs(acc - target) ? m : acc),
    options[0]!,
  );
}
