// IR35 profile — shape, buildAssessment, scoreAssessment, renderOutcome.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearProfiles,
  getProfile,
  getProfileForCountry,
  registerProfile,
} from '../../../registry.js';
import type { AnswerMap, Assessment } from '../../../types/assessment.js';
import type { Ir35Outcome } from '../../../types/outcome.js';
import { IR35_QUESTIONS, IR35Profile, RULE_SET_VERSION } from '../index.js';

describe('IR35Profile', () => {
  let profile: IR35Profile;

  beforeEach(() => {
    profile = new IR35Profile();
  });

  describe('profile shape', () => {
    it('has profileId "ir35"', () => {
      expect(profile.profileId).toBe('ir35');
    });

    it('has country "GB"', () => {
      expect(profile.country).toBe('GB');
    });

    it('has displayName "IR35 (United Kingdom)"', () => {
      expect(profile.displayName).toBe('IR35 (United Kingdom)');
    });

    it('has ruleSetVersion matching the RULE_SET_VERSION constant', () => {
      expect(profile.ruleSetVersion).toBe(RULE_SET_VERSION);
    });
  });

  describe('buildAssessment', () => {
    it('returns an AssessmentShell with correct profileId', () => {
      const shell = profile.buildAssessment('eng-123');
      expect(shell.profileId).toBe('ir35');
    });

    it('returns an AssessmentShell with ruleSetVersion', () => {
      const shell = profile.buildAssessment('eng-123');
      expect(shell.ruleSetVersion).toBe(RULE_SET_VERSION);
    });

    it('returns all 25 IR35 questions', () => {
      const shell = profile.buildAssessment('eng-123');
      expect(shell.questions).toHaveLength(25);
      expect(shell.questions).toBe(IR35_QUESTIONS);
    });
  });

  describe('scoreAssessment', () => {
    it('returns an IR35 outcome for empty answers', () => {
      const outcome = profile.scoreAssessment({});
      expect(outcome.kind).toBe('IR35');
      expect(outcome.ruleSetVersion).toBe(RULE_SET_VERSION);
    });

    it('returns "indeterminate" for empty answers', () => {
      const outcome = profile.scoreAssessment({});
      expect(outcome.verdict).toBe('indeterminate');
    });

    it('returns "inside" when substitution is prohibited', () => {
      const answers: AnswerMap = { 'Q-SUB-05': { value: 'yes' } };
      const outcome = profile.scoreAssessment(answers);
      expect(outcome.verdict).toBe('inside');
    });

    it('returns an outcome with 5 areas', () => {
      const outcome = profile.scoreAssessment({});
      if (outcome.kind === 'IR35') {
        expect(outcome.areas).toHaveLength(5);
      }
    });
  });

  describe('renderOutcome', () => {
    function makeAssessment(outcome: Ir35Outcome): Assessment {
      return {
        id: 'test-id',
        organizationId: 'org-1',
        contractorAssignmentId: 'ca-1',
        countryCode: 'GB',
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

    it('renders inside verdict with employment summary', () => {
      const outcome: Ir35Outcome = {
        kind: 'IR35',
        ruleSetVersion: RULE_SET_VERSION,
        verdict: 'inside',
        areas: [],
        computedAt: new Date().toISOString(),
      };
      const view = profile.renderOutcome(makeAssessment(outcome));
      expect(view.kind).toBe('IR35');
      expect(view.verdict).toBe('inside');
      expect(view.summary).toMatch(/Inside IR35/);
    });

    it('renders outside verdict with self-employment summary', () => {
      const outcome: Ir35Outcome = {
        kind: 'IR35',
        ruleSetVersion: RULE_SET_VERSION,
        verdict: 'outside',
        areas: [],
        computedAt: new Date().toISOString(),
      };
      const view = profile.renderOutcome(makeAssessment(outcome));
      expect(view.verdict).toBe('outside');
      expect(view.summary).toMatch(/Outside IR35/);
    });

    it('renders indeterminate verdict', () => {
      const outcome: Ir35Outcome = {
        kind: 'IR35',
        ruleSetVersion: RULE_SET_VERSION,
        verdict: 'indeterminate',
        areas: [],
        computedAt: new Date().toISOString(),
      };
      const view = profile.renderOutcome(makeAssessment(outcome));
      expect(view.verdict).toBe('indeterminate');
      expect(view.summary).toMatch(/Indeterminate/);
    });

    it('throws when outcome is null', () => {
      const assessment = makeAssessment(null as unknown as Ir35Outcome);
      expect(() => profile.renderOutcome(assessment)).toThrow(/expected IR35 outcome/);
    });

    it('throws when outcome kind does not match', () => {
      const assessment = makeAssessment({
        kind: 'SCHEINSELBSTANDIGKEIT' as 'IR35',
        ruleSetVersion: RULE_SET_VERSION,
        verdict: 'inside',
        areas: [],
        computedAt: new Date().toISOString(),
      });
      expect(() => profile.renderOutcome(assessment)).toThrow(/expected IR35 outcome/);
    });
  });

  describe('side-effect registration (CLASS-01)', () => {
    it('can be re-registered after clearing the registry', () => {
      clearProfiles();
      registerProfile(new IR35Profile());
      expect(getProfile('ir35')).toBeDefined();
      expect(getProfileForCountry('GB')).toBeDefined();
    });
  });
});
