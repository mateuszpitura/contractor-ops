/**
 * The `MarketplaceListing` model tracks one row per platform (ZAPIER/N8N/MAKE)
 * with a validated review-state machine: DRAFT -> SUBMITTED -> IN_REVIEW ->
 * LIVE / REJECTED / NEEDS_CHANGES, rejecting illegal jumps. Each staff mutation
 * writes an audit row.
 */

import { describe, expect, it } from 'vitest';

import {
  isValidListingTransition,
  MARKETPLACE_LISTING_STATUSES,
  MARKETPLACE_PLATFORMS,
} from '../routers/core/marketplace-listing';

describe('marketplace listing taxonomy', () => {
  it('tracks the three marketplace platforms', () => {
    expect([...MARKETPLACE_PLATFORMS].sort()).toEqual(['MAKE', 'N8N', 'ZAPIER'].sort());
  });

  it('defines the full review-state set', () => {
    expect([...MARKETPLACE_LISTING_STATUSES].sort()).toEqual(
      ['DRAFT', 'IN_REVIEW', 'LIVE', 'NEEDS_CHANGES', 'REJECTED', 'SUBMITTED'].sort(),
    );
  });
});

describe('review-state machine', () => {
  it.each([
    ['DRAFT', 'SUBMITTED'],
    ['SUBMITTED', 'IN_REVIEW'],
    ['IN_REVIEW', 'LIVE'],
    ['IN_REVIEW', 'NEEDS_CHANGES'],
    ['IN_REVIEW', 'REJECTED'],
    ['NEEDS_CHANGES', 'SUBMITTED'],
    ['LIVE', 'NEEDS_CHANGES'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(isValidListingTransition(from, to)).toBe(true);
  });

  it.each([
    ['DRAFT', 'LIVE'],
    ['DRAFT', 'IN_REVIEW'],
    ['SUBMITTED', 'LIVE'],
    ['LIVE', 'DRAFT'],
    ['REJECTED', 'LIVE'],
  ] as const)('rejects the illegal jump %s -> %s', (from, to) => {
    expect(isValidListingTransition(from, to)).toBe(false);
  });
});
