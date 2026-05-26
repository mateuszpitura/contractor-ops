import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '../../../__tests__/test-utils.js';
import { I18nInput } from '../i18n-input.js';

const LOCALES = ['en', 'pl', 'de', 'ar'] as const;

describe('I18nInput', () => {
  it('renders the active-locale value in the text field', () => {
    render(
      <I18nInput
        value={{ en: 'Hello', pl: '' }}
        onChange={vi.fn()}
        locales={LOCALES}
        defaultLocale="en"
      />,
    );

    expect(screen.getByRole('textbox')).toHaveValue('Hello');
  });

  it('falls back to locales[0] when defaultLocale is not in the set', () => {
    render(
      <I18nInput
        value={{ en: 'En', pl: 'Pl' }}
        onChange={vi.fn()}
        locales={LOCALES}
        defaultLocale="zz"
      />,
    );

    expect(screen.getByRole('textbox')).toHaveValue('En');
  });

  it('forwards typed value to onChange keyed by the active locale', async () => {
    const onChange = vi.fn();
    const { user } = setup(
      <I18nInput
        value={{ en: 'Hi', pl: 'Cześć' }}
        onChange={onChange}
        locales={LOCALES}
        defaultLocale="en"
      />,
    );

    await user.type(screen.getByRole('textbox'), '!');

    // The last call should include the new char on the active (en) locale.
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ en: 'Hi!', pl: 'Cześć' }));
  });

  it('switches the visible value when a different locale is selected', async () => {
    const { user } = setup(
      <I18nInput
        value={{ en: 'Hello', pl: 'Witaj' }}
        onChange={vi.fn()}
        locales={LOCALES}
        defaultLocale="en"
      />,
    );

    expect(screen.getByRole('textbox')).toHaveValue('Hello');

    await user.click(screen.getByRole('button', { name: /switch language/i }));
    const plLabel = await screen.findByText('PL', { selector: 'span' });
    await user.click(plLabel);

    expect(screen.getByRole('textbox')).toHaveValue('Witaj');
  });
});
