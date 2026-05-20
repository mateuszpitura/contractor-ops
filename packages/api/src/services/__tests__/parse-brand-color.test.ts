import { describe, expect, it } from 'vitest';
import { parseBrandColor } from '../org-cache';

/**
 * Defense-in-depth: the parser feeds an inline CSS variable on the portal
 * shell. Anything that slips through could turn into a CSS-injection vector
 * (`expression()`, `url(...)`, attribute breakouts). Lock the accepted shapes
 * down explicitly.
 */
describe('parseBrandColor', () => {
  it.each([
    ['#0a84ff', '#0a84ff'],
    ['#0A84FF', '#0a84ff'],
    ['#fff', '#fff'],
    ['hsl(210, 100%, 52%)', 'hsl(210, 100%, 52%)'],
    ['hsl(210 100% 52%)', 'hsl(210 100% 52%)'],
    ['hsla(210, 100%, 52%, 0.8)', 'hsla(210, 100%, 52%, 0.8)'],
  ])('accepts %s', (input, expected) => {
    expect(parseBrandColor(input)).toBe(expected);
  });

  it.each([
    [''],
    ['  '],
    ['#xyz'],
    ['#12'],
    ['#1234'],
    ['#1234567'],
    ['rgb(255, 0, 0)'],
    ['red'],
    ['expression(alert(1))'],
    ['url(http://attacker.tld)'],
    ['hsl(0, 200%, 50%)'],
    ['hsl(0, 50%, 200%)'],
    ['hsl(notnumeric, 50%, 50%)'],
    ['hsla(210, 100%, 52%, 1.5)'],
    ['hsla(210, 100%, 52%, -0.1)'],
    ['hsla(210, 100%, 52%, 150%)'],
    ['hsla(210, 100%, 52%, -10%)'],
    [null],
    [undefined],
    [123],
    [{}],
  ])('rejects %p', input => {
    expect(parseBrandColor(input as unknown)).toBeNull();
  });

  it('accepts hsla with in-range numeric and percentage alpha', () => {
    expect(parseBrandColor('hsla(210, 100%, 52%, 0)')).toBe('hsla(210, 100%, 52%, 0)');
    expect(parseBrandColor('hsla(210, 100%, 52%, 1)')).toBe('hsla(210, 100%, 52%, 1)');
    expect(parseBrandColor('hsla(210, 100%, 52%, 50%)')).toBe('hsla(210, 100%, 52%, 50%)');
  });
});
