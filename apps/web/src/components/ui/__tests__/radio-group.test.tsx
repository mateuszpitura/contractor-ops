import { render, screen, setup } from '@/test/test-utils';
import { RadioGroup, RadioGroupItem } from '../radio-group';

describe('RadioGroup', () => {
  it('renders radio group with items', () => {
    render(
      <RadioGroup>
        <label>
          <RadioGroupItem value="a" />
          Option A
        </label>
        <label>
          <RadioGroupItem value="b" />
          Option B
        </label>
      </RadioGroup>,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
  });

  it('sets data-slot on group', () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="a" />
      </RadioGroup>,
    );
    const group = document.querySelector("[data-slot='radio-group']");
    expect(group).toBeInTheDocument();
  });

  it('sets data-slot on items', () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="x" />
      </RadioGroup>,
    );
    const item = document.querySelector("[data-slot='radio-group-item']");
    expect(item).toBeInTheDocument();
  });

  it('merges custom className on group', () => {
    render(
      <RadioGroup className="custom-rg">
        <RadioGroupItem value="a" />
      </RadioGroup>,
    );
    const group = document.querySelector("[data-slot='radio-group']");
    expect(group?.className).toContain('custom-rg');
  });

  it('merges custom className on item', () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="a" className="custom-ri" />
      </RadioGroup>,
    );
    const item = document.querySelector("[data-slot='radio-group-item']");
    expect(item?.className).toContain('custom-ri');
  });

  it('selects an item on click', async () => {
    const { user } = setup(
      <RadioGroup>
        <label>
          <RadioGroupItem value="a" />
          Option A
        </label>
        <label>
          <RadioGroupItem value="b" />
          Option B
        </label>
      </RadioGroup>,
    );
    const radios = screen.getAllByRole('radio');
    await user.click(radios[0]!);
    expect(radios[0]).toBeChecked();
    expect(radios[1]).not.toBeChecked();
  });

  it('respects defaultValue', () => {
    render(
      <RadioGroup defaultValue="b">
        <RadioGroupItem value="a" />
        <RadioGroupItem value="b" />
      </RadioGroup>,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).not.toBeChecked();
    expect(radios[1]).toBeChecked();
  });

  it('supports disabled state', () => {
    render(
      <RadioGroup disabled>
        <RadioGroupItem value="a" />
      </RadioGroup>,
    );
    expect(screen.getByRole('radio')).toHaveAttribute('aria-disabled', 'true');
  });
});
