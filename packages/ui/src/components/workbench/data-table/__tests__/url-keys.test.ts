import { DATA_TABLE_URL_KEYS, DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE_OPTIONS } from '../types.js';

describe('DataTable canonical constants', () => {
  it('exposes the spec page-size options', () => {
    expect([...DEFAULT_PAGE_SIZE_OPTIONS]).toEqual([10, 25, 50, 100]);
  });

  it('defaults page size to 25 per spec', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(25);
  });

  it('locks URL keys to page/size/sort/q + f. prefix', () => {
    expect(DATA_TABLE_URL_KEYS.pageIndex).toBe('page');
    expect(DATA_TABLE_URL_KEYS.pageSize).toBe('size');
    expect(DATA_TABLE_URL_KEYS.sort).toBe('sort');
    expect(DATA_TABLE_URL_KEYS.query).toBe('q');
    expect(DATA_TABLE_URL_KEYS.filterPrefix).toBe('f.');
  });

  it('freezes DATA_TABLE_URL_KEYS so callers can not mutate it', () => {
    expect(Object.isFrozen(DATA_TABLE_URL_KEYS)).toBe(true);
  });
});
