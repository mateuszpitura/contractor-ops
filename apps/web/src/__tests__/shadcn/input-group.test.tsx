import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from '@contractor-ops/ui/components/shadcn/input-group';
import { render, screen, setup } from '@/test/test-utils';

describe('InputGroup', () => {
  it('renders children', () => {
    render(
      <InputGroup>
        <InputGroupInput placeholder="Enter text" />
      </InputGroup>,
    );
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('sets data-slot on root', () => {
    render(
      <InputGroup>
        <InputGroupInput />
      </InputGroup>,
    );
    const group = document.querySelector("[data-slot='input-group']");
    expect(group).toBeInTheDocument();
  });

  it('has role=group on root', () => {
    render(
      <InputGroup>
        <InputGroupInput />
      </InputGroup>,
    );
    const groups = screen.getAllByRole('group');
    expect(groups[0]).toHaveAttribute('data-slot', 'input-group');
  });

  it('merges custom className on root', () => {
    render(
      <InputGroup className="my-group">
        <InputGroupInput />
      </InputGroup>,
    );
    const group = document.querySelector("[data-slot='input-group']");
    expect(group?.className).toContain('my-group');
  });
});

describe('InputGroupAddon', () => {
  it('sets data-slot', () => {
    render(
      <InputGroup>
        <InputGroupAddon>$</InputGroupAddon>
        <InputGroupInput />
      </InputGroup>,
    );
    const addon = document.querySelector("[data-slot='input-group-addon']");
    expect(addon).toBeInTheDocument();
  });

  it('defaults to inline-start alignment', () => {
    render(
      <InputGroup>
        <InputGroupAddon>$</InputGroupAddon>
        <InputGroupInput />
      </InputGroup>,
    );
    const addon = document.querySelector("[data-slot='input-group-addon']");
    expect(addon).toHaveAttribute('data-align', 'inline-start');
  });

  it('supports inline-end alignment', () => {
    render(
      <InputGroup>
        <InputGroupInput />
        <InputGroupAddon align="inline-end">.00</InputGroupAddon>
      </InputGroup>,
    );
    const addon = document.querySelector("[data-slot='input-group-addon']");
    expect(addon).toHaveAttribute('data-align', 'inline-end');
  });

  it('focuses input when clicked', async () => {
    const { user } = setup(
      <InputGroup>
        <InputGroupAddon data-testid="addon">$</InputGroupAddon>
        <InputGroupInput data-testid="input" />
      </InputGroup>,
    );
    await user.click(screen.getByTestId('addon'));
    expect(screen.getByTestId('input')).toHaveFocus();
  });
});

describe('InputGroupButton', () => {
  it('renders a button', () => {
    render(
      <InputGroup>
        <InputGroupInput />
        <InputGroupAddon align="inline-end">
          <InputGroupButton>Go</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>,
    );
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });

  it('defaults to type=button', () => {
    render(
      <InputGroup>
        <InputGroupButton>Click</InputGroupButton>
      </InputGroup>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('InputGroupText', () => {
  it('renders text content', () => {
    render(
      <InputGroup>
        <InputGroupText>USD</InputGroupText>
        <InputGroupInput />
      </InputGroup>,
    );
    expect(screen.getByText('USD')).toBeInTheDocument();
  });
});

describe('InputGroupInput', () => {
  it('sets data-slot=input-group-control', () => {
    render(
      <InputGroup>
        <InputGroupInput />
      </InputGroup>,
    );
    const input = document.querySelector("[data-slot='input-group-control']");
    expect(input).toBeInTheDocument();
    expect(input?.tagName).toBe('INPUT');
  });
});

describe('InputGroupTextarea', () => {
  it('renders a textarea with data-slot', () => {
    render(
      <InputGroup>
        <InputGroupTextarea placeholder="Type here" />
      </InputGroup>,
    );
    const textarea = screen.getByPlaceholderText('Type here');
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea).toHaveAttribute('data-slot', 'input-group-control');
  });
});
