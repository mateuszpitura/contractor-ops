// ---------------------------------------------------------------------------
// Classification Rule-Set Types
// ---------------------------------------------------------------------------

import type { Ir35Area, ScheinCategory, UsQuestionCategory } from './outcome.js';

/** Supported answer input types (maps 1:1 to UI components). */
export type AnswerType = 'yes-no' | 'likert-5' | 'score-0-3' | 'billing-ratio' | 'rationale';

/** Canonical per-locale prompt/help shape. */
export interface LocalisedText {
  readonly en: string;
  readonly pl: string;
  readonly de: string;
}

/** Single question in a rule set. */
export interface RuleSetQuestion {
  readonly id: string;
  /** IR35 only — one of the 5 HMRC areas. */
  readonly area?: Ir35Area;
  /**
   * DRV Scheinselbständigkeit category, or a US worker-classification category
   * (one of the federal common-law factors, an AB5 prong, or a §530 condition).
   */
  readonly category?: ScheinCategory | UsQuestionCategory;
  readonly prompt: LocalisedText;
  readonly helpText: LocalisedText;
  /** IR35 case-law citation (e.g. "Ready Mixed Concrete [1968] 2 QB 497"). */
  readonly caseLawCitation?: string;
  /** DRV reference (e.g. "DRV-Katalog § 7 SGB IV, Merkmal 3.1"). */
  readonly drvReference?: string;
  /** US case-law / statute citation (IRS common-law SS-8, CA Labor Code §2775, §530 Revenue Act 1978). */
  readonly citation?: string;
  /** US only — every federal factor, AB5 prong, and §530 condition is adviser-verify (nothing here is final legal advice). */
  readonly adviserVerify?: boolean;
  readonly answerType: AnswerType;
  /** Optional per-question weight; used in IR35 composite rule. */
  readonly weight?: number;
  readonly required: boolean;
}

/** A complete country rule set (IR35 or DRV). */
export interface RuleSet {
  readonly profileId: string;
  readonly ruleSetVersion: string;
  readonly countryCode: string;
  readonly questions: readonly RuleSetQuestion[];
}
