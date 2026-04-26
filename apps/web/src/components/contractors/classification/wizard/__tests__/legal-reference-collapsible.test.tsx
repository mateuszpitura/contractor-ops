import { describe, expect, it } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';

import { LegalReferenceCollapsible } from '../legal-reference-collapsible';

describe('LegalReferenceCollapsible', () => {
  it('renders a toggle button', () => {
    render(
      <LegalReferenceCollapsible citation="Ready Mixed Concrete [1968] 2 QB 497" kind="case-law" />,
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('does not show citation text by default (collapsed)', () => {
    render(
      <LegalReferenceCollapsible citation="Ready Mixed Concrete [1968] 2 QB 497" kind="case-law" />,
    );

    expect(screen.queryByText('Ready Mixed Concrete [1968] 2 QB 497')).not.toBeInTheDocument();
  });

  it('shows citation text after clicking the toggle button', async () => {
    const { user } = setup(
      <LegalReferenceCollapsible citation="DRV-Katalog § 7 SGB IV, Merkmal 3.1" kind="drv" />,
    );

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('DRV-Katalog § 7 SGB IV, Merkmal 3.1')).toBeInTheDocument();
  });

  it('sets data-kind attribute on the content element', async () => {
    const { user } = setup(<LegalReferenceCollapsible citation="Some citation" kind="drv" />);

    await user.click(screen.getByRole('button'));

    const content = screen.getByText('Some citation').closest('[data-kind]');
    expect(content).toHaveAttribute('data-kind', 'drv');
  });
});
