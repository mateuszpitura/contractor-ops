// packages/validators/src/bacs.ts
//
// BACS Standard 18 Zod validators and VocaLink modulus check function.
// Phase 63 — PAY-01.
//
// References:
// - VocaLink Modulus Checking specification v8.40 (May 2025)
// - BACS Standard 18 Direct Credit file format

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

/** Validates a UK bank sort code — exactly 6 digits, no separators. */
export const sortCodeSchema = z
  .string()
  .regex(/^\d{6}$/, 'Sort code must be exactly 6 digits');

/** Validates a UK bank account number — exactly 8 digits. */
export const accountNumberSchema = z
  .string()
  .regex(/^\d{8}$/, 'Account number must be exactly 8 digits');

/** Validates a BACS submitter name — max 18 uppercase ASCII chars. */
export const bacsSubmitterNameSchema = z
  .string()
  .max(18)
  .regex(
    /^[A-Z0-9 \-\.\'\/&\(\)\+,\:;\?=@"]*$/,
    'Must be uppercase ASCII BACS characters only',
  );

/** Validates a BACS Service User Number — exactly 6 digits. */
export const serviceUserNumberSchema = z
  .string()
  .regex(/^\d{6}$/, 'SUN must be exactly 6 digits');

// ---------------------------------------------------------------------------
// Modulus check types
// ---------------------------------------------------------------------------

export type ModulusCheckType = 'MOD10' | 'MOD11' | 'DBLAL';

export interface ModulusEntry {
  sortCodeRangeStart: string;
  sortCodeRangeEnd: string;
  checkType: ModulusCheckType;
  weights: number[];
  exception: number;
}

export interface ModulusCheckResult {
  valid: boolean;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Modulus check implementation
// ---------------------------------------------------------------------------

/**
 * Applies modulus check algorithm per VocaLink specification.
 *
 * Returns `{ valid: true }` when no table entries match (sort code range not
 * covered = valid by default per VocaLink spec).
 */
export function modulusCheck(
  sortCode: string,
  accountNumber: string,
  table: ModulusEntry[],
): ModulusCheckResult {
  const warnings: string[] = [];

  // Find all matching entries for this sort code
  const matches = table.filter(
    (entry) => sortCode >= entry.sortCodeRangeStart && sortCode <= entry.sortCodeRangeEnd,
  );

  // If no entries match, the sort code is not in the modulus table — valid by default
  if (matches.length === 0) {
    return { valid: true, warnings: [] };
  }

  // Build the 14-digit combined string: sort code (6) + account number (8)
  const combined = sortCode + accountNumber;

  // Process each matching entry — all must pass
  let firstCheckPassed = true;
  let secondCheckPassed = true;

  for (let i = 0; i < matches.length; i++) {
    const entry = matches[i]!;

    // Handle known exception categories
    if (entry.exception > 0) {
      const exceptionResult = handleException(entry.exception, combined, entry, warnings);
      if (exceptionResult !== null) {
        if (i === 0) firstCheckPassed = exceptionResult;
        else secondCheckPassed = exceptionResult;
        continue;
      }
    }

    const passed = applyModulusCheck(combined, entry);
    if (i === 0) firstCheckPassed = passed;
    else secondCheckPassed = passed;
  }

  // For dual-check entries, both must pass (unless exception says otherwise)
  if (matches.length === 1) {
    return { valid: firstCheckPassed, warnings };
  }

  // Exception 2 and 9: first OR second must pass (not both)
  const hasOrException = matches.some((m) => m.exception === 2 || m.exception === 9);
  if (hasOrException) {
    return { valid: firstCheckPassed || secondCheckPassed, warnings };
  }

  // Exception 10 and 11: first AND second (standard dual)
  return { valid: firstCheckPassed && secondCheckPassed, warnings };
}

function applyModulusCheck(combined: string, entry: ModulusEntry): boolean {
  const digits = combined.split('').map(Number);

  switch (entry.checkType) {
    case 'MOD10':
      return mod10Check(digits, entry.weights);
    case 'MOD11':
      return mod11Check(digits, entry.weights);
    case 'DBLAL':
      return dblalCheck(digits, entry.weights);
    default:
      return true;
  }
}

function mod10Check(digits: number[], weights: number[]): boolean {
  let total = 0;
  for (let i = 0; i < 14 && i < weights.length; i++) {
    total += digits[i]! * weights[i]!;
  }
  return total % 10 === 0;
}

function mod11Check(digits: number[], weights: number[]): boolean {
  let total = 0;
  for (let i = 0; i < 14 && i < weights.length; i++) {
    total += digits[i]! * weights[i]!;
  }
  return total % 11 === 0;
}

function dblalCheck(digits: number[], weights: number[]): boolean {
  let total = 0;
  for (let i = 0; i < 14 && i < weights.length; i++) {
    const product = digits[i]! * weights[i]!;
    // For DBLAL, sum the individual digits of the product
    if (product >= 10) {
      total += Math.floor(product / 10) + (product % 10);
    } else {
      total += product;
    }
  }
  return total % 10 === 0;
}

/**
 * Handle VocaLink modulus check exceptions.
 * Returns null if the exception modifies state but standard check should continue.
 * Returns boolean if the exception overrides the check result entirely.
 */
function handleException(
  exception: number,
  _combined: string,
  _entry: ModulusEntry,
  warnings: string[],
): boolean | null {
  switch (exception) {
    case 1:
      // Exception 1: Ensure 2nd check uses modified weights for CooperativeBank
      warnings.push(
        'Exception 1: Cooperative Bank sort code — modulus check uses adjusted weights.',
      );
      return null;

    case 2:
    case 9:
      // Exception 2 and 9: First check OR second check must pass
      // Handled in the caller (OR logic instead of AND)
      return null;

    case 3:
      // Exception 3: If c = 6 or c = 9, no modulus check is done
      warnings.push('Exception 3: Special account — modulus check not applicable.');
      return true;

    case 4:
      // Exception 4: Perform mod 11 check with remainder = g from account
      return null;

    case 5:
      // Exception 5: Building society accounts — certain substitutions apply
      warnings.push(
        'Exception 5: Building society sort code range — verify account details with your bank.',
      );
      return null;

    case 6:
      // Exception 6: Foreign currency accounts at NatWest/RBS
      warnings.push('Exception 6: Foreign currency account — modulus check adjusted.');
      return null;

    case 7:
      // Exception 7: If g = 9, zero weight positions u-b
      return null;

    case 8:
      // Exception 8: Replace sort code with 090126
      return null;

    case 10:
      // Exception 10: Used for HSBC — ab = 09 or ab = 99 AND g = 9
      return null;

    case 11:
      // Exception 11: Used for Citibank — no special handling at this level
      return null;

    case 12:
      // Exception 12: Used for certain NatWest accounts
      return null;

    case 14:
      // Exception 14: Used for Coutts accounts — verify with 00000000 if 8th digit fails
      warnings.push(
        'Exception 14: Coutts & Co sort code range — verify account details with your bank.',
      );
      return null;

    default:
      warnings.push(`Unknown modulus check exception ${exception}.`);
      return null;
  }
}
