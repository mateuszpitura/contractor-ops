/**
 * web-vite port. Two splits vs legacy:
 *   - Component renamed `LeitwegIdInlineSelectorView` and accepts `options` prop.
 *   - The Create dialog inside the view is a tRPC-bound container; we mock it
 *     to a stub so the view test stays a pure-prop test.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '../../../test/test-utils.js';

vi.mock('../../settings/e-invoicing/leitweg-id-create-dialog.js', () => ({
  LeitwegIdCreateDialog: ({ open }: { open: boolean }) =>
    open ? (
      <div role="dialog">
        <h2>Create Leitweg-ID</h2>
      </div>
    ) : null,
}));

import { LeitwegIdInlineSelectorView } from '../leitweg-id-inline-selector.js';
import { PeppolIdentifierFields } from '../peppol-identifier-fields.js';

const sampleOptions = [
  { id: 'lid-1', value: '991-11111TEST-22' },
  { id: 'lid-2', value: '991-22222TEST-33' },
];

describe('LeitwegIdInlineSelectorView', () => {
  it('renders select with the scoped list options', () => {
    render(
      <LeitwegIdInlineSelectorView
        mode="contractor"
        contractorId="c1"
        value={null}
        onChange={vi.fn()}
        options={sampleOptions}
      />,
    );
    const select = screen.getByTestId('leitweg-inline-select') as HTMLSelectElement;
    expect(select.options.length).toBe(3); // placeholder + 2 rows
  });

  it('calls onChange when user picks an existing id', async () => {
    const onChange = vi.fn();
    const { user } = setup(
      <LeitwegIdInlineSelectorView
        mode="contractor"
        contractorId="c1"
        value={null}
        onChange={onChange}
        options={sampleOptions}
      />,
    );
    const select = screen.getByTestId('leitweg-inline-select') as HTMLSelectElement;
    await user.selectOptions(select, 'lid-1');
    expect(onChange).toHaveBeenCalledWith('lid-1');
  });

  it('opens the Create dialog when "Add new" is clicked', async () => {
    const { user } = setup(
      <LeitwegIdInlineSelectorView
        mode="contractor"
        contractorId="c1"
        value={null}
        onChange={vi.fn()}
        options={sampleOptions}
      />,
    );
    await user.click(screen.getByTestId('leitweg-inline-add-new'));
    expect(screen.getByRole('heading', { name: /create leitweg-id/i })).toBeInTheDocument();
  });

  it('renders the "Leitweg-ID missing" warning alert on DE public-sector buyer without selection', () => {
    render(
      <LeitwegIdInlineSelectorView
        mode="contractor"
        contractorId="c1"
        value={null}
        onChange={vi.fn()}
        options={sampleOptions}
        isPublicSectorBuyer={true}
      />,
    );
    expect(
      screen.getByText(/leitweg-id missing for german public-sector buyer/i),
    ).toBeInTheDocument();
  });

  it('does NOT render the warning when a value is selected', () => {
    render(
      <LeitwegIdInlineSelectorView
        mode="contractor"
        contractorId="c1"
        value="lid-1"
        onChange={vi.fn()}
        options={sampleOptions}
        isPublicSectorBuyer={true}
      />,
    );
    expect(screen.queryByText(/leitweg-id missing for german public-sector buyer/i)).toBeNull();
  });
});

describe('PeppolIdentifierFields — pair constraint', () => {
  it('shows no error when both fields are empty', () => {
    render(<PeppolIdentifierFields value={{ schemeId: '', value: '' }} onChange={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('surfaces pair error when only scheme is provided', () => {
    render(<PeppolIdentifierFields value={{ schemeId: '0060', value: '' }} onChange={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('surfaces pair error when only value is provided', () => {
    render(
      <PeppolIdentifierFields value={{ schemeId: '', value: '12345678' }} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('clears the pair error when both fields are set', () => {
    render(
      <PeppolIdentifierFields value={{ schemeId: '0060', value: '12345678' }} onChange={vi.fn()} />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('calls onValidChange with true when both set and valid', async () => {
    const onValidChange = vi.fn();
    render(
      <PeppolIdentifierFields
        value={{ schemeId: '0060', value: '12345678' }}
        onChange={vi.fn()}
        onValidChange={onValidChange}
      />,
    );
    await Promise.resolve();
    expect(onValidChange).toHaveBeenCalledWith(true);
  });
});
