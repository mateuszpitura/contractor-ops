/**
 * VIES live-smoke — validate a known-good EU VAT number against the live
 * EU Commission REST endpoint. No credentials required (public service), but
 * still gated on RUN_LIVE_SMOKE so the main pipeline stays offline.
 *
 * Proves: the VIES REST contract our gov-api `vies-client` depends on is up
 * and returns the expected shape (RISK note: 2026 REST stability unconfirmed;
 * a red smoke here is the early signal to switch to the SOAP fallback).
 *
 * Side effects: none (read-only lookup of a stable EU test VAT).
 */

import { expect, it } from 'vitest';
import { smokeDescribe, smokeFetch } from './harness.js';

// EU Commission documented sample VAT (DE) — stable test value.
const SAMPLE = { country: 'DE', number: '129273398' };

smokeDescribe('vies', [], () => {
  it('checks a VAT number via the VIES REST API', async () => {
    const res = await smokeFetch(
      `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${SAMPLE.country}/vat/${SAMPLE.number}`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { isValid?: boolean; userError?: string };
    // We assert the contract shape, not validity (the sample may change).
    expect(typeof body.isValid).toBe('boolean');
  });
});
