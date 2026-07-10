// Government-integration stub seams.
//
// Each of the five gov stub modules
// mirrors `elstam-stub`: a typed, network-free function returning
// `{ source: 'STUB', available: false, note }` with PII masked to the last-2
// characters — the seam a later live integration slots into, backed by a MANUAL
// workflow task the HR user completes by hand (no live channel this phase).

import { afterEach, describe, expect, it, vi } from 'vitest';

import { submitAbmeldungSv } from '../abmeldung-sv-stub';
import { submitHmrcRti } from '../hmrc-rti-stub';
import { submitI9EVerify } from '../i9-everify-stub';
import { submitPitFiling } from '../pit-filing-stub';
import { submitZusZwua } from '../zus-zwua-stub';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('gov stub seams — STUB/unavailable shape + PII mask + no network', () => {
  it('submitI9EVerify returns the STUB shape without a network call', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = submitI9EVerify({ ssnLast4: '6789' });
    expect(result).toMatchObject({ source: 'STUB', available: false });
    expect(typeof result.note).toBe('string');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('submitZusZwua masks the PESEL to last-2 and never echoes the full identifier', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = submitZusZwua({ pesel: '44051401359', terminationDate: '2026-06-30' });
    expect(result).toMatchObject({ source: 'STUB', available: false });
    expect(result.note).toContain('59');
    expect(result.note).not.toContain('44051401359');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('submitAbmeldungSv masks the SV number to last-2 without a network call', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = submitAbmeldungSv({ svNumber: '65170839J003', terminationDate: '2026-06-30' });
    expect(result).toMatchObject({ source: 'STUB', available: false });
    expect(result.note).toContain('03');
    expect(result.note).not.toContain('65170839J003');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('submitHmrcRti masks the NINO to last-2 without a network call', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = submitHmrcRti({ niNumber: 'QQ123456C', payrollId: 'PR-1', eventType: 'LEAVER' });
    expect(result).toMatchObject({ source: 'STUB', available: false });
    expect(result.note).toContain('6C');
    expect(result.note).not.toContain('QQ123456C');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('submitPitFiling masks the PESEL to last-2 without a network call', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = submitPitFiling({ pesel: '44051401359', formType: 'PIT-11' });
    expect(result).toMatchObject({ source: 'STUB', available: false });
    expect(result.note).toContain('59');
    expect(result.note).not.toContain('44051401359');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
