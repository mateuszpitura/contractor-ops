// Package barrel — verify all expected exports are present and callable.

import { describe, expect, it } from 'vitest';

import {
  // Answer schemas
  billingRatioSchema,
  // Snapshot
  buildQuestionsSnapshot,
  // Registry
  clearProfiles,
  getAnswerSchemaForType,
  getProfile,
  getProfileForCountry,
  // Assessment schemas
  ir35AreaResultSchema,
  ir35AreaSchema,
  ir35AreaVerdictSchema,
  ir35OutcomeSchema,
  ir35VerdictSchema,
  likert5AnswerSchema,
  listProfiles,
  outcomeSchema,
  rationaleSchema,
  registerProfile,
  scheinCategoryResultSchema,
  scheinCategorySchema,
  scheinOutcomeSchema,
  scheinVerdictSchema,
  score03AnswerSchema,
  yesNoAnswerSchema,
} from '../index.js';

describe('package barrel exports', () => {
  describe('registry functions', () => {
    it('exports clearProfiles as a function', () => {
      expect(typeof clearProfiles).toBe('function');
    });

    it('exports getProfile as a function', () => {
      expect(typeof getProfile).toBe('function');
    });

    it('exports getProfileForCountry as a function', () => {
      expect(typeof getProfileForCountry).toBe('function');
    });

    it('exports listProfiles as a function', () => {
      expect(typeof listProfiles).toBe('function');
    });

    it('exports registerProfile as a function', () => {
      expect(typeof registerProfile).toBe('function');
    });
  });

  describe('answer schema exports', () => {
    it('exports yesNoAnswerSchema', () => {
      expect(yesNoAnswerSchema).toBeDefined();
      expect(yesNoAnswerSchema.parse('yes')).toBe('yes');
    });

    it('exports likert5AnswerSchema', () => {
      expect(likert5AnswerSchema).toBeDefined();
      expect(likert5AnswerSchema.parse(3)).toBe(3);
    });

    it('exports score03AnswerSchema', () => {
      expect(score03AnswerSchema).toBeDefined();
    });

    it('exports billingRatioSchema', () => {
      expect(billingRatioSchema).toBeDefined();
      expect(billingRatioSchema.parse(50)).toBe(50);
    });

    it('exports rationaleSchema', () => {
      expect(rationaleSchema).toBeDefined();
    });

    it('exports getAnswerSchemaForType as a function', () => {
      expect(typeof getAnswerSchemaForType).toBe('function');
    });
  });

  describe('assessment schema exports', () => {
    it('exports ir35AreaSchema', () => {
      expect(ir35AreaSchema).toBeDefined();
    });

    it('exports ir35AreaVerdictSchema', () => {
      expect(ir35AreaVerdictSchema).toBeDefined();
    });

    it('exports ir35AreaResultSchema', () => {
      expect(ir35AreaResultSchema).toBeDefined();
    });

    it('exports ir35VerdictSchema', () => {
      expect(ir35VerdictSchema).toBeDefined();
    });

    it('exports ir35OutcomeSchema', () => {
      expect(ir35OutcomeSchema).toBeDefined();
    });

    it('exports scheinCategorySchema', () => {
      expect(scheinCategorySchema).toBeDefined();
    });

    it('exports scheinVerdictSchema', () => {
      expect(scheinVerdictSchema).toBeDefined();
    });

    it('exports scheinCategoryResultSchema', () => {
      expect(scheinCategoryResultSchema).toBeDefined();
    });

    it('exports scheinOutcomeSchema', () => {
      expect(scheinOutcomeSchema).toBeDefined();
    });

    it('exports outcomeSchema (discriminated union)', () => {
      expect(outcomeSchema).toBeDefined();
    });
  });

  describe('snapshot helper', () => {
    it('exports buildQuestionsSnapshot as a function', () => {
      expect(typeof buildQuestionsSnapshot).toBe('function');
    });
  });

  describe('side-effect profile registration', () => {
    it('registers IR35 and Scheinselbstandigkeit profiles on import', () => {
      const profiles = listProfiles();
      const ids = profiles.map(p => p.profileId);
      expect(ids).toContain('ir35');
      expect(ids).toContain('scheinselbstandigkeit');
    });

    it('getProfileForCountry("GB") returns IR35 profile', () => {
      const profile = getProfileForCountry('GB');
      expect(profile.profileId).toBe('ir35');
      expect(profile.country).toBe('GB');
    });

    it('getProfileForCountry("DE") returns Scheinselbstandigkeit profile', () => {
      const profile = getProfileForCountry('DE');
      expect(profile.profileId).toBe('scheinselbstandigkeit');
      expect(profile.country).toBe('DE');
    });
  });
});
