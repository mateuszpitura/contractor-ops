'use client';

import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import * as React from 'react';
import type { DayButton, Locale } from 'react-day-picker';
import { DayPicker, getDefaultClassNames } from 'react-day-picker';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const CalendarLocaleContext = React.createContext<Partial<Locale> | undefined>(undefined);

function CalendarRoot({
  className,
  rootRef,
  ...props
}: {
  className?: string;
  rootRef?: React.Ref<HTMLDivElement>;
} & React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />;
}

function CalendarChevron({
  className,
  orientation,
  ...props
}: { className?: string; orientation?: string } & React.SVGAttributes<SVGSVGElement>) {
  if (orientation === 'left') {
    return <ChevronLeftIcon className={cn('size-4', className)} {...props} />;
  }

  if (orientation === 'right') {
    return <ChevronRightIcon className={cn('size-4', className)} {...props} />;
  }

  return <ChevronDownIcon className={cn('size-4', className)} {...props} />;
}

function CalendarDayButtonAdapter(props: React.ComponentProps<typeof DayButton>) {
  const locale = React.useContext(CalendarLocaleContext);
  return <CalendarDayButton locale={locale} {...props} />;
}

function CalendarWeekNumber({
  children,
  ...props
}: { children?: React.ReactNode } & React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td {...props}>
      <div className="flex size-(--cell-size) items-center justify-center text-center">
        {children}
      </div>
    </td>
  );
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  buttonVariant = 'ghost',
  locale,
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>['variant'];
}) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <CalendarLocaleContext.Provider value={locale}>
      <DayPicker
        showOutsideDays={showOutsideDays}
        labels={{
          labelPrevious: () => 'Previous month',
          labelNext: () => 'Next month',
        }}
        className={cn(
          'group/calendar bg-background p-2 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(7)] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent',
          String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
          String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
          className,
        )}
        captionLayout={captionLayout}
        locale={locale}
        formatters={{
          formatMonthDropdown: date => date.toLocaleString(locale?.code, { month: 'short' }),
          ...formatters,
        }}
        classNames={{
          root: cn('w-fit', defaultClassNames.root),
          months: cn('relative flex flex-col gap-4 md:flex-row', defaultClassNames.months),
          month: cn('flex w-full flex-col gap-4', defaultClassNames.month),
          nav: cn(
            'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
            defaultClassNames.nav,
          ),
          button_previous: cn(
            buttonVariants({ variant: buttonVariant }),
            'size-(--cell-size) p-0 select-none aria-disabled:opacity-50',
            defaultClassNames.button_previous,
          ),
          button_next: cn(
            buttonVariants({ variant: buttonVariant }),
            'size-(--cell-size) p-0 select-none aria-disabled:opacity-50',
            defaultClassNames.button_next,
          ),
          month_caption: cn(
            'flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)',
            defaultClassNames.month_caption,
          ),
          dropdowns: cn(
            'flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium',
            defaultClassNames.dropdowns,
          ),
          dropdown_root: cn('relative rounded-(--cell-radius)', defaultClassNames.dropdown_root),
          dropdown: cn('absolute inset-0 bg-popover opacity-0', defaultClassNames.dropdown),
          caption_label: cn(
            'font-medium select-none',
            captionLayout === 'label'
              ? 'text-sm'
              : 'flex items-center gap-1 rounded-(--cell-radius) text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground',
            defaultClassNames.caption_label,
          ),
          table: 'w-full border-collapse',
          weekdays: cn('flex', defaultClassNames.weekdays),
          weekday: cn(
            'flex-1 rounded-(--cell-radius) text-[0.8rem] font-normal text-muted-foreground select-none',
            defaultClassNames.weekday,
          ),
          week: cn('mt-2 flex w-full', defaultClassNames.week),
          week_number_header: cn(
            'w-(--cell-size) select-none',
            defaultClassNames.week_number_header,
          ),
          week_number: cn(
            'text-[0.8rem] text-muted-foreground select-none',
            defaultClassNames.week_number,
          ),
          day: cn(
            'group/day relative flex items-center justify-center !p-0 h-full w-full rounded-(--cell-radius) text-center select-none [&:last-child[data-selected=true]_button]:rounded-e-(--cell-radius)',
            props.showWeekNumber
              ? '[&:nth-child(2)[data-selected=true]_button]:rounded-s-(--cell-radius)'
              : '[&:first-child[data-selected=true]_button]:rounded-s-(--cell-radius)',
            defaultClassNames.day,
          ),
          range_start: cn(
            'relative isolate z-0 rounded-s-(--cell-radius) after:absolute after:inset-y-0 after:end-0 after:start-0 after:rounded-s-(--cell-radius) after:bg-muted after:-z-1',
            defaultClassNames.range_start,
          ),
          range_middle: cn(
            'relative rounded-none after:absolute after:inset-y-0 after:inset-x-0 after:bg-muted after:-z-1',
            defaultClassNames.range_middle,
          ),
          range_end: cn(
            'relative isolate z-0 rounded-e-(--cell-radius) after:absolute after:inset-y-0 after:end-0 after:start-0 after:rounded-e-(--cell-radius) after:bg-muted after:-z-1',
            defaultClassNames.range_end,
          ),
          today: cn(
            'rounded-(--cell-radius) text-foreground ring-1 ring-ring/30 data-[selected=true]:rounded-none data-[selected=true]:ring-0',
            defaultClassNames.today,
          ),
          outside: cn(
            'text-muted-foreground aria-selected:text-muted-foreground',
            defaultClassNames.outside,
          ),
          disabled: cn('text-muted-foreground opacity-50', defaultClassNames.disabled),
          hidden: cn('invisible', defaultClassNames.hidden),
          ...classNames,
        }}
        components={{
          Root: CalendarRoot,
          Chevron: CalendarChevron,
          DayButton: CalendarDayButtonAdapter,
          WeekNumber: CalendarWeekNumber,
          ...components,
        }}
        {...props}
      />
    </CalendarLocaleContext.Provider>
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  locale,
  children,
  ...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
  const defaultClassNames = getDefaultClassNames();

  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  const isSelectedEndpoint =
    modifiers.range_start || modifiers.range_end || (modifiers.selected && !modifiers.range_middle);

  const hasActivity = (modifiers as Record<string, unknown>).hasActivity === true;

  return (
    <Button
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString(locale?.code)}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        'relative isolate z-10 flex size-(--cell-size) items-center justify-center border-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-e-(--cell-radius) data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:text-foreground data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-s-(--cell-radius) data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground dark:hover:text-foreground [&>span]:text-xs [&>span]:opacity-70',
        defaultClassNames.day,
        className,
      )}
      {...props}>
      {children}
      {hasActivity && (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full !opacity-100',
            isSelectedEndpoint ? 'bg-primary-foreground/80' : 'bg-primary/60',
          )}
        />
      )}
    </Button>
  );
}

export { Calendar, CalendarDayButton };
