import { describe, expect, it } from 'vitest';

import { derivePeopleReviewQueryState } from '../use-onboarding-people.js';
import { deriveProjectImportQueryState } from '../use-onboarding-projects.js';

describe('derivePeopleReviewQueryState', () => {
  it('marks allSourcesFailed when every selected source errored', () => {
    expect(
      derivePeopleReviewQueryState({
        isLoading: false,
        isError: false,
        peopleCount: 0,
        sourceErrorsCount: 2,
        selectedSourcesCount: 2,
      }),
    ).toEqual({
      allSourcesFailed: true,
      isEmpty: false,
      canContinueStep: false,
    });
  });

  it('does not mark allSourcesFailed when one source succeeds with zero users', () => {
    expect(
      derivePeopleReviewQueryState({
        isLoading: false,
        isError: false,
        peopleCount: 0,
        sourceErrorsCount: 1,
        selectedSourcesCount: 2,
      }),
    ).toEqual({
      allSourcesFailed: false,
      isEmpty: false,
      canContinueStep: true,
    });
  });

  it('marks isEmpty when all sources succeed with zero users', () => {
    expect(
      derivePeopleReviewQueryState({
        isLoading: false,
        isError: false,
        peopleCount: 0,
        sourceErrorsCount: 0,
        selectedSourcesCount: 2,
      }),
    ).toEqual({
      allSourcesFailed: false,
      isEmpty: true,
      canContinueStep: true,
    });
  });
});

describe('deriveProjectImportQueryState', () => {
  it('marks allSourcesFailed when every PM source errored', () => {
    expect(
      deriveProjectImportQueryState({
        isLoading: false,
        isError: false,
        projectsCount: 0,
        sourceErrorsCount: 2,
        pmSourcesCount: 2,
      }),
    ).toEqual({
      allSourcesFailed: true,
      isEmpty: false,
      canContinueStep: false,
    });
  });

  it('allows continue when no PM sources selected', () => {
    expect(
      deriveProjectImportQueryState({
        isLoading: false,
        isError: false,
        projectsCount: 0,
        sourceErrorsCount: 0,
        pmSourcesCount: 0,
      }),
    ).toEqual({
      allSourcesFailed: false,
      isEmpty: true,
      canContinueStep: true,
    });
  });

  it('does not mark allSourcesFailed on partial project fetch failure', () => {
    expect(
      deriveProjectImportQueryState({
        isLoading: false,
        isError: false,
        projectsCount: 3,
        sourceErrorsCount: 1,
        pmSourcesCount: 2,
      }),
    ).toEqual({
      allSourcesFailed: false,
      isEmpty: false,
      canContinueStep: true,
    });
  });
});
