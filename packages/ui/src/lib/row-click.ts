import type { MouseEvent } from 'react';

const INTERACTIVE_SELECTOR = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'label',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="radio"]',
  '[role="menuitem"]',
  '[role="menu"]',
  '[role="dialog"]',
  '[role="combobox"]',
  '[role="option"]',
  '[data-row-click-ignore]',
].join(',');

/**
 * Returns true when the click originated from an interactive child of a
 * table row (checkbox, button, link, dropdown trigger, etc.). Row-level
 * `onClick` handlers should bail out early on those events so that
 * selecting a checkbox or clicking a "delete" button does not also fire
 * the row-open side-effect (e.g. opening a side panel).
 *
 * Opt-out: add `data-row-click-ignore` to any wrapper that should
 * suppress the row click without being a standard interactive element.
 */
export function shouldIgnoreRowClick(event: MouseEvent<HTMLElement>): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  if (event.currentTarget === target) return false;
  return target.closest(INTERACTIVE_SELECTOR) !== null;
}
