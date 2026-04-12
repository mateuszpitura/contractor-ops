import { describe, expect, it } from 'vitest';
import { filterByHealth } from '../compliance-filtering';

const items = [
  { health: 'red' as const, name: 'A' },
  { health: 'yellow' as const, name: 'B' },
  { health: 'green' as const, name: 'C' },
  { health: 'red' as const, name: 'D' },
];

describe('filterByHealth', () => {
  it('returns all items when drillDownHealth is null', () => {
    expect(filterByHealth(items, null)).toEqual(items);
  });

  it('returns all items when drillDownHealth is undefined', () => {
    expect(filterByHealth(items, undefined)).toEqual(items);
  });

  it('maps "critical" to "red"', () => {
    const result = filterByHealth(items, 'critical');
    expect(result).toEqual([
      { health: 'red', name: 'A' },
      { health: 'red', name: 'D' },
    ]);
  });

  it('maps "warning" to "yellow"', () => {
    const result = filterByHealth(items, 'warning');
    expect(result).toEqual([{ health: 'yellow', name: 'B' }]);
  });

  it('maps "ok" to "green"', () => {
    const result = filterByHealth(items, 'ok');
    expect(result).toEqual([{ health: 'green', name: 'C' }]);
  });

  it('accepts raw health values directly', () => {
    expect(filterByHealth(items, 'red')).toEqual([
      { health: 'red', name: 'A' },
      { health: 'red', name: 'D' },
    ]);
    expect(filterByHealth(items, 'yellow')).toEqual([{ health: 'yellow', name: 'B' }]);
    expect(filterByHealth(items, 'green')).toEqual([{ health: 'green', name: 'C' }]);
  });

  it('returns empty array for unknown health value', () => {
    expect(filterByHealth(items, 'unknown')).toEqual([]);
  });

  it('works with empty items array', () => {
    expect(filterByHealth([], 'critical')).toEqual([]);
  });
});
