/**
 * Ported from apps/web/src/components/ocr/__tests__/nip-validation-badge.test.tsx.
 *
 * Web-vite NipValidationBadge swaps `next-intl` for the local i18n
 * compat layer, so we keep the original validateNip checksum coverage
 * and assert the badge labels via the live `OcrReview.nipBadge.*` keys.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { NipValidationBadge, validateNip } from '../nip-validation-badge.js';
import { findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('validateNip', () => {
  it('returns true for a NIP with a passing modulo-11 checksum', () => {
    expect(validateNip('1234563218')).toBe(true);
  });

  it('returns false for a NIP with a failing checksum', () => {
    expect(validateNip('1234567890')).toBe(false);
  });

  it('rejects inputs that are not exactly 10 digits', () => {
    expect(validateNip('12345')).toBe(false);
    expect(validateNip('12345678901')).toBe(false);
    expect(validateNip('abcdefghij')).toBe(false);
  });

  it('strips spaces and dashes before checksumming', () => {
    expect(validateNip('123-456-32-18')).toBe(true);
    expect(validateNip('123 456 32 18')).toBe(true);
  });

  it('returns false for the empty string', () => {
    expect(validateNip('')).toBe(false);
  });
});

describe('NipValidationBadge (web-vite)', () => {
  it('renders nothing when nip is null', async () => {
    const { container } = await mount(<NipValidationBadge nip={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when nip is empty', async () => {
    const { container } = await mount(<NipValidationBadge nip="" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when nip is whitespace only', async () => {
    const { container } = await mount(<NipValidationBadge nip="   " />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the valid badge for a valid NIP', async () => {
    await mount(<NipValidationBadge nip="1234563218" />);
    expect(findByText(document.body, 'Valid NIP format')).not.toBeNull();
  });

  it('renders the invalid badge for an invalid NIP', async () => {
    await mount(<NipValidationBadge nip="1234567890" />);
    expect(findByText(document.body, 'Invalid NIP format')).not.toBeNull();
  });
});
