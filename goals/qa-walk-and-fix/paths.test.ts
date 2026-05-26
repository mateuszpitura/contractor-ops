import { describe, expect, it } from 'vitest';
import {
  buildBaselineKey,
  buildScreenshotFilename,
  comboKey,
  parseBaselineKey,
  parseScreenshotFilename,
  ShotIndexRegistry,
} from './paths.js';

describe('buildScreenshotFilename', () => {
  it('formats default page shot', () => {
    expect(
      buildScreenshotFilename(8, {
        routeId: 'web-contractors-list',
        viewport: 'desktop',
        theme: 'light',
      }),
    ).toBe('008-web-contractors-list-desktop-light.png');
  });

  it('formats modal variant with hyphens only', () => {
    expect(
      buildScreenshotFilename(8, {
        routeId: 'web-contractors-list',
        viewport: 'desktop',
        theme: 'light',
        variant: 'modal-filter-sheet',
      }),
    ).toBe('008-web-contractors-list-desktop-light-modal-filter-sheet.png');
  });
});

describe('parseScreenshotFilename', () => {
  it('parses flat filename', () => {
    expect(parseScreenshotFilename('008-web-approvals-desktop-light-modal-filters.png')).toEqual({
      index: 8,
      routeId: 'web-approvals',
      viewport: 'desktop',
      theme: 'light',
      variant: 'modal-filters',
    });
  });
});

describe('parseBaselineKey', () => {
  it('parses baseline key', () => {
    expect(parseBaselineKey('web-approvals-desktop-light')).toEqual({
      routeId: 'web-approvals',
      viewport: 'desktop',
      theme: 'light',
    });
  });
});

describe('buildBaselineKey', () => {
  it('omits index and variant', () => {
    expect(
      buildBaselineKey({
        routeId: 'web-dashboard-home',
        viewport: 'mobile',
        theme: 'dark',
      }),
    ).toBe('web-dashboard-home-mobile-dark');
  });
});

describe('ShotIndexRegistry', () => {
  it('reuses index for same combo', () => {
    const reg = new ShotIndexRegistry();
    const key = comboKey({
      routeId: 'web-foo',
      locale: 'en',
      viewport: 'desktop',
      theme: 'light',
    });
    expect(reg.getIndex('en', key)).toBe(1);
    expect(reg.getIndex('en', key)).toBe(1);
    expect(
      reg.getIndex(
        'en',
        comboKey({ routeId: 'web-bar', locale: 'en', viewport: 'desktop', theme: 'light' }),
      ),
    ).toBe(2);
  });
});
