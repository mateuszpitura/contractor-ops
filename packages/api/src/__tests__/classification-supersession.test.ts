import { describe, it } from 'vitest';

// This file establishes the RED state for Plan 71-04. Once 71-04 ships
// `submit` mutation transactional refactor + supersedeAndMaterialise helper,
// these tests turn GREEN.

describe('classification.submit — Phase 71 supersession on outcome change (D-10)', () => {
  it.todo(
    'first classification on a new engagement materialises rows from policy registry (UK B2B IR35-INSIDE → 4 rows)',
  );
  it.todo(
    'outcome change UK B2B IR35-INSIDE → DE ABHANGIG: old rows WAIVED with reason classification_outcome_change, new rows inserted',
  );
  it.todo('same outcome resubmit: no row churn');
  it.todo(
    'carry-forward: when new rule documentType matches old, satisfiedByDocumentId + expiresAt copied; status = SATISFIED',
  );
  it.todo('carry-forward: when new rule documentType does NOT match old, status = MISSING');
  it.todo('transactional atomicity: induced failure mid-supersession leaves 0 row mutations');
  it.todo('policyRuleSetVersion snapshotted onto ClassificationAssessment on submit');
});
