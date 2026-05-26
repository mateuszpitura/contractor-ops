/**
 * Render-level coverage for `<ApiErrorMessage>`. Verifies the user never sees
 * a raw `error.message` / camelCase key — only translations from the `Errors`
 * namespace (or the `Errors.generic` fallback).
 */

import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { applyLocale, initI18n } from '../../../i18n/index.js';
import { ApiErrorMessage } from '../api-error-message.js';

beforeAll(async () => {
  initI18n();
  await applyLocale('en');
});

describe('<ApiErrorMessage>', () => {
  it('renders the translation for a known errorKey', () => {
    render(<ApiErrorMessage error={{ data: { errorKey: 'contractorNotFound' } }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Contractor not found.');
  });

  it('renders the generic fallback for an unknown errorKey', () => {
    render(<ApiErrorMessage error={{ data: { errorKey: 'someKeyThatIsNotRegistered' } }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });

  it('renders the generic fallback for a non-tRPC error and never leaks the raw message', () => {
    render(<ApiErrorMessage error={new Error('raw english should not appear')} />);
    const node = screen.getByRole('alert');
    expect(node).toHaveTextContent('Something went wrong. Please try again.');
    expect(node.textContent ?? '').not.toContain('raw english');
  });

  it('forwards className for layout-level overrides', () => {
    render(
      <ApiErrorMessage error={{ data: { errorKey: 'contractorNotFound' } }} className="my-error" />,
    );
    expect(screen.getByRole('alert')).toHaveClass('my-error');
  });
});
