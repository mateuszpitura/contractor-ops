import { render, screen } from '@/test/test-utils';
import { BrandColorPicker } from '../brand-color-picker';

describe('BrandColorPicker', () => {
  it('renders trigger button with aria-label reflecting the selected color', () => {
    render(<BrandColorPicker value="#dc2626" onChange={vi.fn()} />);
    const trigger = screen.getByRole('button');
    expect(trigger.getAttribute('aria-label')).toMatch(/#dc2626/i);
  });
});
