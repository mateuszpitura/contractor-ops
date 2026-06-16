import type { PrismaClient } from '../../src/generated/prisma/client/client.js';

// 1099-NEC federal reporting threshold, keyed by tax year (USD minor units).
//
// NEVER a constant: OBBBA raised the threshold from $600 to $2,000 for payments
// made after 2025-12-31. TY2025 (filed early 2026) is still $600; TY2026 (filed
// early 2027) is $2,000; from 2027 it is inflation-indexed.
//
// PROVISIONAL — needs jurisdiction-specific legal/tax-adviser verification before
// any production filing (LOCAL-ONLY posture). Re-verify each tax-year figure
// against the current IRS Instructions for Forms 1099-MISC and 1099-NEC.
const ADVISER_VERIFY_NOTE =
  'PROVISIONAL — verify with a US tax adviser before production filing; re-confirm per tax year.';

const thresholds = [
  {
    taxYear: 2025,
    box1ThresholdMinor: 60000,
    currency: 'USD',
    note: `$600 (pre-OBBBA). ${ADVISER_VERIFY_NOTE}`,
  },
  {
    taxYear: 2026,
    box1ThresholdMinor: 200000,
    currency: 'USD',
    note: `$2,000 (OBBBA). ${ADVISER_VERIFY_NOTE}`,
  },
];

const STATE_VERIFY_NOTE =
  'PROVISIONAL — re-verify per tax year against the IRS CF/SF coordinator FAQ and Pub 1220 / IRIS state-record guidance before production reliance.';

type StateRow = {
  stateCode: string;
  cfsfParticipant: boolean;
  requiresDirectFiling: boolean;
  note: string;
};

// Combined Federal/State Filing (CF/SF) participation and direct-filing posture.
//
// The CF/SF participant list drifts year to year; this is a developer-authored
// placeholder seeded identically for TY2025 and TY2026 and MUST be adviser-verified
// and re-checked per tax year. Maryland participates in name but no longer processes
// CF/SF files and requires direct filing (a special case). The non-CF/SF / direct-file
// states produce a downloadable state output instead of being IRS auto-forwarded.
const cfsfParticipants = [
  'AL',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'GA',
  'HI',
  'ID',
  'IN',
  'KS',
  'LA',
  'ME',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NJ',
  'NM',
  'NC',
  'ND',
  'OH',
  'OK',
  'RI',
  'SC',
  'WI',
];

// Participates in CF/SF in name but requires direct filing (does not process the
// auto-forwarded file).
const cfsfButDirectFiling = ['MD'];

// States with no income tax / no 1099 filing requirement, plus the remaining
// direct-file / special-requirement states. Modeled as non-CF/SF direct-file so the
// per-state output path covers them; adviser-verify whether each actually requires a
// return.
const directFilingStates = [
  'AK',
  'FL',
  'IL',
  'IA',
  'KY',
  'NV',
  'NH',
  'NY',
  'OR',
  'PA',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WY',
  'DC',
];

function buildStateRows(): StateRow[] {
  const rows: StateRow[] = [];
  for (const stateCode of cfsfParticipants) {
    rows.push({
      stateCode,
      cfsfParticipant: true,
      requiresDirectFiling: false,
      note: `CF/SF participant (IRS auto-forwards). ${STATE_VERIFY_NOTE}`,
    });
  }
  for (const stateCode of cfsfButDirectFiling) {
    rows.push({
      stateCode,
      cfsfParticipant: true,
      requiresDirectFiling: true,
      note: `Participates in CF/SF in name but requires direct filing. ${STATE_VERIFY_NOTE}`,
    });
  }
  for (const stateCode of directFilingStates) {
    rows.push({
      stateCode,
      cfsfParticipant: false,
      requiresDirectFiling: true,
      note: `Non-CF/SF — direct file or no requirement. ${STATE_VERIFY_NOTE}`,
    });
  }
  return rows;
}

const stateTaxYears = [2025, 2026];

export async function seedTax1099Config(prisma: PrismaClient): Promise<void> {
  for (const threshold of thresholds) {
    await prisma.tax1099Threshold.upsert({
      where: { taxYear: threshold.taxYear },
      update: { ...threshold },
      create: { ...threshold },
    });
  }

  const stateRows = buildStateRows();
  for (const taxYear of stateTaxYears) {
    for (const row of stateRows) {
      await prisma.stateFilingConfig.upsert({
        where: { stateCode_taxYear: { stateCode: row.stateCode, taxYear } },
        update: { ...row, taxYear },
        create: { ...row, taxYear },
      });
    }
  }
}
