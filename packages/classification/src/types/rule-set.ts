// ---------------------------------------------------------------------------
// Classification Rule-Set Types — D-06
// ---------------------------------------------------------------------------

import type { Ir35Area, ScheinCategory } from './outcome.js';

/** Supported answer input types (maps 1:1 to UI components). */
export type AnswerType =
  | 'yes-no'
  | 'likert-5'
  | 'score-0-3'
  | 'billing-ratio'
  | 'rationale';

/** Canonical per-locale prompt/help shape. */
export interface LocalisedText {
  readonly en: string;
  readonly pl: string;
  readonly de: string;
}

/** Single question in a rule set (D-06). */
export interface RuleSetQuestion {
  readonly id: string;
  /** IR35 only — one of the 5 HMRC areas. */
  readonly area?: Ir35Area;
  /** DRV only — one of the 4 Scheinselbständigkeit categories. */
  readonly category?: ScheinCategory;
  readonly prompt: LocalisedText;
  readonly helpText: LocalisedText;
  /** IR35 case-law citation (e.g. "Ready Mixed Concrete [1968] 2 QB 497"). */
  readonly caseLawCitation?: string;
  /** DRV reference (e.g. "DRV-Katalog § 7 SGB IV, Merkmal 3.1"). */
  readonly drvReference?: string;
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
