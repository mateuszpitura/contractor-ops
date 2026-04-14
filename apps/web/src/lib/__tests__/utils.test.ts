import { describe, expect, it } from 'vitest';
import { cn } from '../utils';

describe('cn', () => {
  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('passes through a single class', () => {
    expect(cn('px-4')).toBe('px-4');
  });

  it('merges multiple classes', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
  });

  it('handles conditional classes via clsx syntax', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('handles undefined and null inputs', () => {
    expect(cn('px-4', undefined, null, 'py-2')).toBe('px-4 py-2');
  });

  it('merges conflicting Tailwind classes (last wins)', () => {
    const result = cn('px-4', 'px-8');
    expect(result).toBe('px-8');
  });

  it('merges conflicting padding classes', () => {
    const result = cn('p-4', 'p-2');
    expect(result).toBe('p-2');
  });

  it('merges conflicting text color classes', () => {
    const result = cn('text-red-500', 'text-blue-500');
    expect(result).toBe('text-blue-500');
  });

  it('preserves non-conflicting classes', () => {
    const result = cn('px-4', 'text-sm', 'bg-white');
    expect(result).toBe('px-4 text-sm bg-white');
  });

  it('handles array inputs', () => {
    expect(cn(['px-4', 'py-2'])).toBe('px-4 py-2');
  });

  it('handles object inputs', () => {
    expect(cn({ 'px-4': true, hidden: false, 'py-2': true })).toBe('px-4 py-2');
  });

  it('handles mixed input types', () => {
    const result = cn('base', ['flex', 'items-center'], { 'font-bold': true });
    expect(result).toBe('base flex items-center font-bold');
  });

  it('deduplicates identical classes', () => {
    const result = cn('px-4', 'px-4');
    expect(result).toBe('px-4');
  });
});
