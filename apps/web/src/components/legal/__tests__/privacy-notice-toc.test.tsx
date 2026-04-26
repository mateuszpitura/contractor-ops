import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { PrivacyNoticeToc } from '../privacy-notice-toc';

describe('PrivacyNoticeToc', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders nothing when no h2 headings exist', () => {
    const { container } = render(<PrivacyNoticeToc />);
    expect(container.innerHTML).toBe('');
  });

  it('renders TOC links from main h2 headings', () => {
    // Set up DOM with headings inside <main>
    const main = document.createElement('main');
    const h2a = document.createElement('h2');
    h2a.id = 'section-1';
    h2a.textContent = 'Introduction';
    const h2b = document.createElement('h2');
    h2b.id = 'section-2';
    h2b.textContent = 'Your Rights';
    main.appendChild(h2a);
    main.appendChild(h2b);
    document.body.appendChild(main);

    render(<PrivacyNoticeToc />);

    expect(screen.getByText('On this page')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Introduction' })).toHaveAttribute(
      'href',
      '#section-1',
    );
    expect(screen.getByRole('link', { name: 'Your Rights' })).toHaveAttribute('href', '#section-2');
  });

  it('renders nav with accessible label', () => {
    const main = document.createElement('main');
    const h2 = document.createElement('h2');
    h2.id = 'test';
    h2.textContent = 'Test Section';
    main.appendChild(h2);
    document.body.appendChild(main);

    render(<PrivacyNoticeToc />);
    expect(screen.getByRole('navigation', { name: 'Table of contents' })).toBeInTheDocument();
  });
});
