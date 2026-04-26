/**
 * Equipment shared helpers and constants unit tests.
 *
 * Tests the pure utility functions and constant maps exported from
 * equipment-shared.ts: plain(), EQUIPMENT_STATUS_TRANSITIONS,
 * SHIPMENT_TO_EQUIPMENT_STATUS, and error constants.
 */

import { describe, expect, it } from 'vitest';

import {
  CONTRACTOR_NOT_FOUND,
  EQUIPMENT_CURRENTLY_ASSIGNED,
  EQUIPMENT_NOT_ASSIGNED,
  EQUIPMENT_NOT_AVAILABLE,
  EQUIPMENT_NOT_FOUND,
  EQUIPMENT_STATUS_TRANSITIONS,
  NOTIFICATION_KEYS,
  plain,
  SHIPMENT_CANNOT_DELETE,
  SHIPMENT_NOT_FOUND,
  SHIPMENT_TO_EQUIPMENT_STATUS,
} from '../equipment-shared.js';

// ===========================================================================
// plain()
// ===========================================================================

describe('plain()', () => {
  it('returns a JSON-serializable copy of the input', () => {
    const input = { id: '1', name: 'Laptop', nested: { a: 1 } };
    const result = plain(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it('strips non-serializable properties (functions, undefined)', () => {
    const input = {
      id: '1',
      fn: () => {
        /* noop */
      },
      undef: undefined,
      name: 'Test',
    };
    const result = plain(input);
    expect(result).toEqual({ id: '1', name: 'Test' });
    expect(result).not.toHaveProperty('fn');
    expect(result).not.toHaveProperty('undef');
  });

  it('handles arrays', () => {
    const input = [{ id: '1' }, { id: '2' }];
    const result = plain(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it('handles null and primitive values', () => {
    expect(plain(null)).toBeNull();
    expect(plain('hello')).toBe('hello');
    expect(plain(42)).toBe(42);
  });
});

// ===========================================================================
// EQUIPMENT_STATUS_TRANSITIONS
// ===========================================================================

describe('EQUIPMENT_STATUS_TRANSITIONS', () => {
  it('AVAILABLE can transition to ASSIGNED, IN_TRANSIT, and RETIRED', () => {
    expect(EQUIPMENT_STATUS_TRANSITIONS.AVAILABLE).toEqual(
      expect.arrayContaining(['ASSIGNED', 'IN_TRANSIT', 'RETIRED']),
    );
  });

  it('ASSIGNED can transition to AVAILABLE, IN_TRANSIT, RETURN_REQUESTED, RETIRED', () => {
    expect(EQUIPMENT_STATUS_TRANSITIONS.ASSIGNED).toEqual(
      expect.arrayContaining(['AVAILABLE', 'IN_TRANSIT', 'RETURN_REQUESTED', 'RETIRED']),
    );
  });

  it('RETIRED has no valid transitions (terminal state)', () => {
    expect(EQUIPMENT_STATUS_TRANSITIONS.RETIRED).toEqual([]);
  });

  it('IN_TRANSIT can transition to DELIVERED or AVAILABLE', () => {
    expect(EQUIPMENT_STATUS_TRANSITIONS.IN_TRANSIT).toEqual(
      expect.arrayContaining(['DELIVERED', 'AVAILABLE']),
    );
  });

  it('RETURN_IN_TRANSIT can transition to RETURNED or AVAILABLE', () => {
    expect(EQUIPMENT_STATUS_TRANSITIONS.RETURN_IN_TRANSIT).toEqual(
      expect.arrayContaining(['RETURNED', 'AVAILABLE']),
    );
  });
});

// ===========================================================================
// SHIPMENT_TO_EQUIPMENT_STATUS
// ===========================================================================

describe('SHIPMENT_TO_EQUIPMENT_STATUS', () => {
  it('DELIVERED + OUTBOUND maps to DELIVERED equipment status', () => {
    expect(SHIPMENT_TO_EQUIPMENT_STATUS.DELIVERED?.OUTBOUND).toBe('DELIVERED');
  });

  it('DELIVERED + RETURN maps to RETURNED equipment status', () => {
    expect(SHIPMENT_TO_EQUIPMENT_STATUS.DELIVERED?.RETURN).toBe('RETURNED');
  });

  it('RETURNED + RETURN maps to RETURNED equipment status', () => {
    expect(SHIPMENT_TO_EQUIPMENT_STATUS.RETURNED?.RETURN).toBe('RETURNED');
  });

  it('RETURNED + OUTBOUND maps to undefined (no equipment change)', () => {
    expect(SHIPMENT_TO_EQUIPMENT_STATUS.RETURNED?.OUTBOUND).toBeUndefined();
  });

  it('unknown shipment status returns undefined', () => {
    expect(SHIPMENT_TO_EQUIPMENT_STATUS.CREATED).toBeUndefined();
    expect(SHIPMENT_TO_EQUIPMENT_STATUS.IN_TRANSIT).toBeUndefined();
  });
});

// ===========================================================================
// NOTIFICATION_KEYS
// ===========================================================================

describe('NOTIFICATION_KEYS', () => {
  it('exposes equipment.returnApproved i18n keys', () => {
    expect(NOTIFICATION_KEYS.equipment.returnApproved.title).toBe(
      'notifications.equipment.returnApproved.title',
    );
    expect(NOTIFICATION_KEYS.equipment.returnApproved.body).toBe(
      'notifications.equipment.returnApproved.body',
    );
  });

  it('exposes equipment.returnRejected i18n keys', () => {
    expect(NOTIFICATION_KEYS.equipment.returnRejected.title).toBe(
      'notifications.equipment.returnRejected.title',
    );
    expect(NOTIFICATION_KEYS.equipment.returnRejected.body).toBe(
      'notifications.equipment.returnRejected.body',
    );
  });
});

// ===========================================================================
// Error constants
// ===========================================================================

describe('error constants', () => {
  it('exports all expected error string constants', () => {
    expect(EQUIPMENT_NOT_FOUND).toBe('EQUIPMENT_NOT_FOUND');
    expect(EQUIPMENT_NOT_AVAILABLE).toBe('EQUIPMENT_NOT_AVAILABLE');
    expect(EQUIPMENT_NOT_ASSIGNED).toBe('EQUIPMENT_NOT_ASSIGNED');
    expect(EQUIPMENT_CURRENTLY_ASSIGNED).toBe('EQUIPMENT_CURRENTLY_ASSIGNED');
    expect(CONTRACTOR_NOT_FOUND).toBe('CONTRACTOR_NOT_FOUND');
    expect(SHIPMENT_NOT_FOUND).toBe('SHIPMENT_NOT_FOUND');
    expect(SHIPMENT_CANNOT_DELETE).toBe('SHIPMENT_CANNOT_DELETE');
  });
});
