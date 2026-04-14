// Scheinselbstandigkeit profile — shape, buildAssessment, scoreAssessment, renderOutcome.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearProfiles,
  getProfile,
  getProfileForCountry,
  registerProfile,
} from '../../../registry.js';
import type { AnswerMap, Assessment } from '../../../types/assessment.js';
import type { ScheinselbstandigkeitOutcome } from '../../../types/outcome.js';
import { RULE_SET_VERSION, SCHEIN_QUESTIONS, ScheinselbstandigkeitProfile } from '../index.js';

describe('ScheinselbstandigkeitProfile', () => {
  let profile: ScheinselbstandigkeitProfile;

  beforeEach(() => {
    profile = new ScheinselbstandigkeitProfile();
  });

  describe('profile shape', () => {
    it('has profileId "scheinselbstandigkeit"', () => {
      expect(profile.profileId).toBe('scheinselbstandigkeit');
    });

    it('has country "DE"', () => {
      expect(profile.country).toBe('DE');
    });

    it('has correct displayName', () => {
      expect(profile.displayName).toBe('Scheinselbständigkeit (DE)');
    });

    it('has ruleSetVersion matching the RULE_SET_VERSION constant', () => {
      expect(profile.ruleSetVersion).toBe(RULE_SET_VERSION);
    });
  });

  describe('buildAssessment', () => {
    it('returns an AssessmentShell with correct profileId', () => {
      const shell = profile.buildAssessment('eng-456');
      expect(shell.profileId).toBe('scheinselbstandigkeit');
    });

    it('returns an AssessmentShell with ruleSetVersion', () => {
      const shell = profile.buildAssessment('eng-456');
      expect(shell.ruleSetVersion).toBe(RULE_SET_VERSION);
    });

    it('returns all 20 Schein questions', () => {
      const shell = profile.buildAssessment('eng-456');
      expect(shell.questions).toHaveLength(20);
      expect(shell.questions).toBe(SCHEIN_QUESTIONS);
    });
  });

  describe('scoreAssessment', () => {
    /** Build minimal required answers — all rawScore 0 (lowest risk). */
    function allRequiredZero(): AnswerMap {
      const answers: AnswerMap = {};
      for (const q of SCHEIN_QUESTIONS) {
        if (q.required) {
          if (q.id === 'DRV-ECO-01') {
            answers[q.id] = { value: 0 };
          } else {
            answers[q.id] = { rawScore: 0 };
          }
        }
      }
      return answers;
    }

    it('returns a SCHEINSELBSTANDIGKEIT outcome', () => {
      const outcome = profile.scoreAssessment(allRequiredZero());
      expect(outcome.kind).toBe('SCHEINSELBSTANDIGKEIT');
    });

    it('returns "green" for all-zero answers', () => {
      const outcome = profile.scoreAssessment(allRequiredZero());
      expect(outcome.verdict).toBe('green');
    });

    it('returns "red" for all max-score answers', () => {
      const answers: AnswerMap = {};
      for (const q of SCHEIN_QUESTIONS) {
        if (q.id === 'DRV-ECO-01') {
          answers[q.id] = { value: 100 };
        } else {
          answers[q.id] = { rawScore: 3 };
        }
      }
      const outcome = profile.scoreAssessment(answers);
      expect(outcome.verdict).toBe('red');
    });

    it('throws MissingAnswerError when required answers are absent', () => {
      expect(() => profile.scoreAssessment({})).toThrow(/missing required answer/);
    });

    it('returns 4 category results', () => {
      const outcome = profile.scoreAssessment(allRequiredZero());
      if (outcome.kind === 'SCHEINSELBSTANDIGKEIT') {
        expect(outcome.categories).toHaveLength(4);
      }
    });
  });

  describe('renderOutcome', () => {
    function makeAssessment(outcome: ScheinselbstandigkeitOutcome): Assessment {
      return {
        id: 'test-id',
        organizationId: 'org-1',
        contractorAssignmentId: 'ca-1',
        countryCode: 'DE',
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

    it('renders green verdict summary', () => {
      const outcome: ScheinselbstandigkeitOutcome = {
        kind: 'SCHEINSELBSTANDIGKEIT',
        ruleSetVersion: RULE_SET_VERSION,
        verdict: 'green',
        totalScore: 15,
        categories: [],
        computedAt: new Date().toISOString(),
      };
      const view = profile.renderOutcome(makeAssessment(outcome));
      expect(view.kind).toBe('SCHEINSELBSTANDIGKEIT');
      expect(view.verdict).toBe('green');
      expect(view.summary).toMatch(/Niedriges Risiko/);
    });

    it('renders amber verdict summary', () => {
      const outcome: ScheinselbstandigkeitOutcome = {
        kind: 'SCHEINSELBSTANDIGKEIT',
        ruleSetVersion: RULE_SET_VERSION,
        verdict: 'amber',
        totalScore: 45,
        categories: [],
        computedAt: new Date().toISOString(),
      };
      const view = profile.renderOutcome(makeAssessment(outcome));
      expect(view.verdict).toBe('amber');
      expect(view.summary).toMatch(/Mittleres Risiko/);
    });

    it('renders red verdict summary', () => {
      const outcome: ScheinselbstandigkeitOutcome = {
        kind: 'SCHEINSELBSTANDIGKEIT',
        ruleSetVersion: RULE_SET_VERSION,
        verdict: 'red',
        totalScore: 75,
        categories: [],
        computedAt: new Date().toISOString(),
      };
      const view = profile.renderOutcome(makeAssessment(outcome));
      expect(view.verdict).toBe('red');
      expect(view.summary).toMatch(/Hohes Risiko/);
      expect(view.summary).toMatch(/Statusfeststellungsverfahren/);
    });

    it('throws when outcome is null', () => {
      const assessment = makeAssessment(null as unknown as ScheinselbstandigkeitOutcome);
      expect(() => profile.renderOutcome(assessment)).toThrow(
        /expected SCHEINSELBSTANDIGKEIT outcome/,
      );
    });

    it('throws when outcome kind does not match', () => {
      const assessment = makeAssessment({
        kind: 'IR35' as 'SCHEINSELBSTANDIGKEIT',
        ruleSetVersion: RULE_SET_VERSION,
        verdict: 'green',
        totalScore: 0,
        categories: [],
        computedAt: new Date().toISOString(),
      });
      expect(() => profile.renderOutcome(assessment)).toThrow(
        /expected SCHEINSELBSTANDIGKEIT outcome/,
      );
    });
  });

  describe('side-effect registration (CLASS-01)', () => {
    it('can be re-registered after clearing the registry', () => {
      clearProfiles();
      registerProfile(new ScheinselbstandigkeitProfile());
      expect(getProfile('scheinselbstandigkeit')).toBeDefined();
      expect(getProfileForCountry('DE')).toBeDefined();
    });
  });
});
