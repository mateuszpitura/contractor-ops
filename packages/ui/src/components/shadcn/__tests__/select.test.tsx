import { afterEach, vi } from 'vitest';
import { render, screen, setup } from '../../../__tests__/test-utils.js';
import type { SelectValueLabelMissEvent } from '../select.js';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  SelectValueLabel,
  setSelectErrorSink,
} from '../select.js';

function renderSelect({
  defaultOpen = false,
  defaultValue,
}: {
  defaultOpen?: boolean;
  defaultValue?: string;
} = {}) {
  return setup(
    <Select defaultOpen={defaultOpen} defaultValue={defaultValue}>
      <SelectTrigger>
        <SelectValue placeholder="Select an option" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Fruits</SelectLabel>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectSeparator />
          <SelectItem value="cherry">Cherry</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>,
  );
}

describe('Select', () => {
  it('renders the trigger', () => {
    renderSelect();
    expect(screen.getByText('Select an option')).toBeInTheDocument();
  });

  it('does not show options when closed', () => {
    renderSelect();
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();
  });

  it('shows options when defaultOpen', () => {
    renderSelect({ defaultOpen: true });
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.getByText('Cherry')).toBeInTheDocument();
  });

  it('renders group label', () => {
    renderSelect({ defaultOpen: true });
    expect(screen.getByText('Fruits')).toBeInTheDocument();
  });

  it('SelectTrigger merges custom className', () => {
    render(
      <Select>
        <SelectTrigger className="my-trigger">
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );
    const trigger = document.querySelector("[data-slot='select-trigger']");
    expect(trigger?.className).toContain('my-trigger');
  });

  it('SelectTrigger supports size prop', () => {
    render(
      <Select>
        <SelectTrigger size="sm">
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );
    const trigger = document.querySelector("[data-slot='select-trigger']");
    expect(trigger).toHaveAttribute('data-size', 'sm');
  });

  it('SelectSeparator sets data-slot', () => {
    renderSelect({ defaultOpen: true });
    const sep = document.querySelector("[data-slot='select-separator']");
    expect(sep).toBeInTheDocument();
  });

  it('SelectLabel sets data-slot', () => {
    renderSelect({ defaultOpen: true });
    const label = document.querySelector("[data-slot='select-label']");
    expect(label).toBeInTheDocument();
  });
});

describe('SelectTrigger — loading / error states', () => {
  function renderAsync(props: { loading?: boolean; error?: { message: string } | null } = {}) {
    return render(
      <Select>
        <SelectTrigger loading={props.loading} error={props.error ?? null}>
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="DRAFT">Draft</SelectItem>
        </SelectContent>
      </Select>,
    );
  }

  it('renders the spinner and disables interaction while loading', () => {
    renderAsync({ loading: true });
    const trigger = document.querySelector("[data-slot='select-trigger']");
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute('aria-busy', 'true');
    expect(trigger).toHaveAttribute('data-state-async', 'loading');
    expect(trigger?.querySelector('.animate-spin')).not.toBeNull();
  });

  it('renders the alert icon and disables interaction on error', () => {
    renderAsync({ error: { message: 'Failed to load contractors' } });
    const trigger = document.querySelector("[data-slot='select-trigger']");
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute('data-state-async', 'error');

    const alertIcon = screen.getByRole('img', { name: 'Failed to load contractors' });
    expect(alertIcon).toBeInTheDocument();
  });

  it('prefers loading over error when both are set', () => {
    renderAsync({ loading: true, error: { message: 'never visible' } });
    const trigger = document.querySelector("[data-slot='select-trigger']");
    expect(trigger).toHaveAttribute('data-state-async', 'loading');
    expect(screen.queryByRole('img', { name: 'never visible' })).toBeNull();
  });

  it('stays interactive when neither flag is set', () => {
    renderAsync();
    const trigger = document.querySelector("[data-slot='select-trigger']");
    expect(trigger).not.toBeDisabled();
    expect(trigger).toHaveAttribute('data-state-async', 'resolved');
    expect(trigger).not.toHaveAttribute('aria-busy');
  });
});

describe('SelectValueLabel', () => {
  const OPTIONS = [
    { value: 'DRAFT', label: 'Draft' },
    { value: 'COMPLETED', label: 'Completed' },
  ] as const;

  const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } })
    .process.env;
  const originalNodeEnv = env.NODE_ENV;

  const noopSink = () => undefined;

  afterEach(() => {
    env.NODE_ENV = originalNodeEnv;
    setSelectErrorSink(noopSink);
  });

  it('renders the matching option label for the current value', () => {
    render(<SelectValueLabel value="COMPLETED" options={OPTIONS} />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('throws in development when the value does not match any option', () => {
    env.NODE_ENV = 'development';
    expect(() =>
      render(<SelectValueLabel value="ARCHIVED" options={OPTIONS} context="status" />),
    ).toThrow(/no option for value "ARCHIVED"/);
  });

  it('logs via the error sink and renders a muted fallback in production', () => {
    env.NODE_ENV = 'production';
    const sink = vi.fn();
    setSelectErrorSink(sink);

    render(<SelectValueLabel value="ARCHIVED" options={OPTIONS} context="status" />);

    expect(sink).toHaveBeenCalledTimes(1);
    const event = sink.mock.calls[0]![0] as SelectValueLabelMissEvent;
    expect(event).toMatchObject({
      component: 'SelectValueLabel',
      value: 'ARCHIVED',
      availableValues: ['DRAFT', 'COMPLETED'],
      context: 'status',
    });

    const fallback = screen.getByText('ARCHIVED');
    expect(fallback).toHaveAttribute('data-fallback', 'unknown-key');
    expect(fallback.className).toContain('text-muted-foreground');
  });
});
