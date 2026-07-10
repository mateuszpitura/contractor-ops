import {
  getProfileForCountry,
  resolveUsWorkState,
  withUsWorkState,
} from '@contractor-ops/classification';
import { describe, expect, it } from 'vitest';

describe('classification.submit US work-state injection', () => {
  it('sets ab5Flag and employee verdict for CA work state when AB5 prong B fails', () => {
    const workState = resolveUsWorkState({
      assignmentWorkState: 'CA',
      contractorUsState: 'TX',
    });
    const answers = withUsWorkState({}, workState);
    const outcome = getProfileForCountry('US').scoreAssessment(answers);

    expect(outcome.ab5Flag).toBe(true);
    expect(outcome.verdict).toBe('employee');
  });

  it('prefers engagement workState over contractor residence for AB5', () => {
    const workState = resolveUsWorkState({
      assignmentWorkState: 'CA',
      contractorUsState: 'NY',
    });
    expect(workState).toBe('CA');
  });
});
