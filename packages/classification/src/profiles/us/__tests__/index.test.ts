// US profile — shape, registration, AB5 work-state trigger + fallback, renderOutcome.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearProfiles,
  getProfile,
  getProfileForCountry,
  registerProfile,
} from '../../../registry.js';
import type { AnswerMap, Assessment } from '../../../types/assessment.js';
import type { UsClassificationOutcome } from '../../../types/outcome.js';
import {
  RULE_SET_VERSION,
  resolveUsWorkState,
  UsClassificationProfile,
  withUsWorkState,
} from '../index.js';
import { US_WORK_STATE_CONTEXT_KEY } from '../rule-set.js';

describe('UsClassificationProfile', () => {
  let profile: UsClassificationProfile;

  beforeEach(() => {
    profile = new UsClassificationProfile();
  });

  describe('profile shape', () => {
    it('has profileId "us-classification"', () => {
      expect(profile.profileId).toBe('us-classification');
    });

    it('has country "US"', () => {
      expect(profile.country).toBe('US');
    });

    it('has ruleSetVersion matching the frozen constant', () => {
      expect(profile.ruleSetVersion).toBe(RULE_SET_VERSION);
      expect(RULE_SET_VERSION).toBe('US-2026-COMMONLAW-AB5');
    });
  });

  describe('side-effect registration', () => {
    it('resolves the US profile via getProfileForCountry after registration', () => {
      clearProfiles();
      registerProfile(new UsClassificationProfile());
      expect(getProfile('us-classification')).toBeDefined();
      const resolved = getProfileForCountry('US');
      expect(resolved.country).toBe('US');
      expect(resolved.profileId).toBe('us-classification');
    });

    it('resolves case-insensitively (lower-case country code)', () => {
      clearProfiles();
      registerProfile(new UsClassificationProfile());
      expect(getProfileForCountry('us').profileId).toBe('us-classification');
    });
  });

  describe('buildAssessment', () => {
    it('returns the US question shell', () => {
      const shell = profile.buildAssessment('eng-1');
      expect(shell.profileId).toBe('us-classification');
      expect(shell.ruleSetVersion).toBe(RULE_SET_VERSION);
      expect(shell.questions.length).toBeGreaterThanOrEqual(12);
    });
  });

  describe('scoreAssessment — AB5 work-state trigger via the reserved context key', () => {
    it('auto-flags AB5 when the injected work state is CA', () => {
      const answers = withUsWorkState({}, 'CA');
      const outcome = profile.scoreAssessment(answers);
      expect(outcome.kind).toBe('US_CLASSIFICATION');
      if (outcome.kind === 'US_CLASSIFICATION') {
        expect(outcome.ab5Flag).toBe(true);
        // No ABC prong passes → dispositive default to employee.
        expect(outcome.verdict).toBe('employee');
      }
    });

    it('does not flag AB5 for a non-California work state', () => {
      const answers = withUsWorkState({}, 'TX');
      const outcome = profile.scoreAssessment(answers);
      if (outcome.kind === 'US_CLASSIFICATION') {
        expect(outcome.ab5Flag).toBe(false);
      }
    });

    it('does not flag AB5 when no work state is present in the answers', () => {
      const outcome = profile.scoreAssessment({});
      if (outcome.kind === 'US_CLASSIFICATION') {
        expect(outcome.ab5Flag).toBe(false);
      }
    });

    it('permits independent-contractor in CA only when all three ABC prongs pass', () => {
      const answers: AnswerMap = withUsWorkState(
        {
          'Q-USAB5-A': { value: 'yes' },
          'Q-USAB5-B': { value: 'yes' },
          'Q-USAB5-C': { value: 'yes' },
        },
        'CA',
      );
      const outcome = profile.scoreAssessment(answers);
      if (outcome.kind === 'US_CLASSIFICATION') {
        expect(outcome.verdict).toBe('independent-contractor');
      }
    });
  });

  describe('resolveUsWorkState — engagement work-state first, contractor US state as fallback', () => {
    it('uses the engagement work state when present', () => {
      expect(resolveUsWorkState({ assignmentWorkState: 'CA', contractorUsState: 'TX' })).toBe('CA');
    });

    it('falls back to the contractor US state when the work state is unset', () => {
      expect(resolveUsWorkState({ assignmentWorkState: null, contractorUsState: 'CA' })).toBe('CA');
    });

    it('falls back to the contractor US state when the work state is blank', () => {
      expect(resolveUsWorkState({ assignmentWorkState: '  ', contractorUsState: 'CA' })).toBe('CA');
    });

    it('returns null when neither is set', () => {
      expect(resolveUsWorkState({})).toBeNull();
    });

    it('feeds the fallback CA state through to an AB5 auto-flag', () => {
      const workState = resolveUsWorkState({ assignmentWorkState: null, contractorUsState: 'CA' });
      const outcome = profile.scoreAssessment(withUsWorkState({}, workState));
      if (outcome.kind === 'US_CLASSIFICATION') {
        expect(outcome.ab5Flag).toBe(true);
      }
    });
  });

  describe('withUsWorkState', () => {
    it('writes the work state under the reserved context key', () => {
      const answers = withUsWorkState({}, 'CA');
      expect(answers[US_WORK_STATE_CONTEXT_KEY]?.value).toBe('CA');
    });

    it('leaves the answers untouched for a null work state', () => {
      const original: AnswerMap = { 'Q-USAB5-A': { value: 'yes' } };
      expect(withUsWorkState(original, null)).toBe(original);
    });
  });

  describe('renderOutcome', () => {
    function makeAssessment(outcome: UsClassificationOutcome | null): Assessment {
      return {
        id: 'test-id',
        organizationId: 'org-1',
        contractorAssignmentId: 'ca-1',
        countryCode: 'US',
        ruleSetVersion: RULE_SET_VERSION,
        status: 'completed',
        questionsSnapshot: null,
        answers: {},
        outcome,
        completedAt: new Date(),
        disclaimerAcknowledgedAt: null,
        immutableAfter: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    function makeOutcome(verdict: UsClassificationOutcome['verdict']): UsClassificationOutcome {
      return {
        kind: 'US_CLASSIFICATION',
        ruleSetVersion: RULE_SET_VERSION,
        verdict,
        federalFactors: [],
        ab5Flag: false,
        section530ReliefEligible: false,
        computedAt: new Date().toISOString(),
      };
    }

    it('renders an employee verdict with an advisory summary', () => {
      const view = profile.renderOutcome(makeAssessment(makeOutcome('employee')));
      expect(view.kind).toBe('US_CLASSIFICATION');
      expect(view.verdict).toBe('employee');
      expect(view.summary).toMatch(/advisory/i);
    });

    it('throws when the outcome kind does not match', () => {
      const assessment = makeAssessment({ kind: 'IR35' } as unknown as UsClassificationOutcome);
      expect(() => profile.renderOutcome(assessment)).toThrow(/expected US_CLASSIFICATION/);
    });
  });
});
