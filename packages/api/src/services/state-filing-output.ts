// Per-state 1099-NEC filing output.
//
// For a Combined Federal/State Filing (CFSF) participant the state code rides in
// the IRIS B-record and the IRS auto-forwards the return — no separate state
// submission or file. For a non-CFSF state, or a CFSF-in-name-but-direct-filing
// state (e.g. Maryland), this emits a downloadable per-state CSV (recipients +
// box-1 / box-4 / state-withholding figures) plus documented manual-portal
// guidance. There is NO bespoke per-state e-file integration — the operator
// files directly with the state's department of revenue.
//
// ADVISER-VERIFY: the CFSF participant list, direct-filing exceptions, and any
// state withholding boxes are jurisdiction-specific and require tax-adviser
// sign-off before production filing (local-only / legal-deferred posture).

import { escapeCsvField } from '../lib/csv';

/** One recipient's figures for the per-state output (all amounts USD minor units). */
export interface StateFilingRecipient {
  recipientId: string;
  recipientName: string;
  /** Recipient TIN last-4 only — a full SSN/TIN is never emitted to a state file. */
  recipientTinLast4: string;
  box1AmountMinor: number;
  box4BackupWithholdingMinor: number;
  /** State income tax withheld, when recorded (USD minor units). */
  stateWithholdingMinor?: number;
}

/** The applied StateFilingConfig fields the output routing needs. */
export interface StateFilingConfigInput {
  stateCode: string;
  cfsfParticipant: boolean;
  requiresDirectFiling: boolean;
  note?: string | null;
}

export interface StateFilingOutput {
  stateCode: string;
  cfsfParticipant: boolean;
  requiresDirectFiling: boolean;
  /**
   * True when the state is satisfied by the CFSF state code in the IRIS B-record
   * (IRS auto-forwards) — no separate file. False when the operator must file
   * directly with the state (CSV + manual guidance).
   */
  cfsfHandled: boolean;
  recipientCount: number;
  totalBox1Minor: number;
  totalStateWithholdingMinor: number;
  /** Per-state CSV for direct-filing states; null when CFSF-handled. */
  csv: string | null;
  guidance: string;
  /** Adviser-verify note carried from the state config. */
  note: string | null;
}

const ADVISER_VERIFY_NOTE =
  'State CFSF participation + direct-filing rules require tax-adviser verification before production filing.';

/** USD minor units (cents) -> a plain dollar string with two decimals. */
function usd(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

function buildStateCsv(stateCode: string, recipients: readonly StateFilingRecipient[]): string {
  const header = [
    'Recipient',
    'RecipientTINLast4',
    'State',
    'Box1NonemployeeCompensationUSD',
    'Box4FederalTaxWithheldUSD',
    'StateIncomeTaxWithheldUSD',
  ];
  const lines = [header.map(escapeCsvField).join(',')];
  for (const r of recipients) {
    lines.push(
      [
        escapeCsvField(r.recipientName),
        escapeCsvField(r.recipientTinLast4),
        escapeCsvField(stateCode),
        escapeCsvField(usd(r.box1AmountMinor)),
        escapeCsvField(usd(r.box4BackupWithholdingMinor)),
        escapeCsvField(usd(r.stateWithholdingMinor ?? 0)),
      ].join(','),
    );
  }
  return lines.join('\r\n');
}

/**
 * Route a state's recipients to CFSF auto-forward (B-record code, no file) or a
 * downloadable per-state CSV + manual-portal guidance.
 *
 * CFSF-handled when the state participates in CFSF AND does not require direct
 * filing; otherwise the operator files directly with the state and gets the CSV.
 */
export function buildStateFilingOutput(
  config: StateFilingConfigInput,
  recipients: readonly StateFilingRecipient[],
): StateFilingOutput {
  const cfsfHandled = config.cfsfParticipant && !config.requiresDirectFiling;
  const totalBox1Minor = recipients.reduce((sum, r) => sum + r.box1AmountMinor, 0);
  const totalStateWithholdingMinor = recipients.reduce(
    (sum, r) => sum + (r.stateWithholdingMinor ?? 0),
    0,
  );

  const guidance = cfsfHandled
    ? `Auto-forwarded to ${config.stateCode} via the Combined Federal/State Filing program (the CFSF state code rides in the IRIS B-record). No separate state submission is required. ${ADVISER_VERIFY_NOTE}`
    : `${config.stateCode} requires direct state filing. Download the per-state CSV and submit it through the ${config.stateCode} department of revenue's portal per its instructions — this app does not e-file to the state on your behalf. ${ADVISER_VERIFY_NOTE}`;

  return {
    stateCode: config.stateCode,
    cfsfParticipant: config.cfsfParticipant,
    requiresDirectFiling: config.requiresDirectFiling,
    cfsfHandled,
    recipientCount: recipients.length,
    totalBox1Minor,
    totalStateWithholdingMinor,
    csv: cfsfHandled ? null : buildStateCsv(config.stateCode, recipients),
    guidance,
    note: config.note ?? null,
  };
}
