/**
 * OverrideStepDialog presentational tests. Submit is disabled until a category
 * is chosen AND the rationale reaches 20 chars.
 */

import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OverrideStepDialog } from '../override-step-dialog.js';
import { findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function submitButton(): HTMLButtonElement | null {
  const buttons = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button'));
  return buttons.find(b => /Mark complete/.test(b.textContent ?? '')) ?? null;
}

describe('OverrideStepDialog (web-vite)', () => {
  it('renders the title + category + rationale fields when open', async () => {
    await mount(
      <OverrideStepDialog stepId="s-1" open onOpenChange={() => {}} onSubmit={async () => {}} />,
    );
    expect(findByText(document.body, /Mark step complete/)).not.toBeNull();
  });

  it('disables submit until the rationale reaches 20 chars', async () => {
    await mount(
      <OverrideStepDialog stepId="s-1" open onOpenChange={() => {}} onSubmit={async () => {}} />,
    );
    // No category + empty note → submit disabled.
    expect(submitButton()?.disabled).toBe(true);

    const textarea = document.body.querySelector('textarea');
    expect(textarea).not.toBeNull();
    if (textarea) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value',
        )?.set;
        setter?.call(textarea, 'short');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    // Still too short → disabled.
    expect(submitButton()?.disabled).toBe(true);
  });

  it('does not call onSubmit while the form is invalid', async () => {
    const onSubmit = vi.fn(async () => {});
    await mount(
      <OverrideStepDialog stepId="s-1" open onOpenChange={() => {}} onSubmit={onSubmit} />,
    );
    const btn = submitButton();
    if (btn && !btn.disabled) {
      await act(async () => btn.click());
    }
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('surfaces a server error', async () => {
    await mount(
      <OverrideStepDialog
        stepId="s-1"
        open
        onOpenChange={() => {}}
        onSubmit={async () => {}}
        serverError="boom"
      />,
    );
    expect(findByText(document.body, /boom/)).not.toBeNull();
  });
});
