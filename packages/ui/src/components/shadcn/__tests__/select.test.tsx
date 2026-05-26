import { render, screen, setup } from '../../../__tests__/test-utils.js';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
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
