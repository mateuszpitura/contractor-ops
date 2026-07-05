import type { Jurisdiction } from '@contractor-ops/compliance-policy';

/** The two employee-lifecycle template kinds (mirrors WorkflowTemplateType). */
export type LifecycleType = 'ONBOARDING' | 'OFFBOARDING';

/**
 * Government-integration seam a MANUAL/NOTIFICATION task is backed by. Each maps
 * to a network-free stub function (see `@contractor-ops/api` gov stubs). No live
 * channel is wired this phase — the HR user completes the step by hand.
 */
export type GovStubKind = 'ZUS_ZWUA' | 'ABMELDUNG_SV' | 'HMRC_RTI' | 'I9_EVERIFY' | 'PIT_FILING';

/**
 * Statutory certificate an OFFBOARDING task emits (draft PDF, adviser-verify
 * watermarked). Matches the react-pdf template set + `certType` on
 * StatutoryCertificate. v7.5 deferrals (qualified Arbeitszeugnis, P11D, COBRA,
 * 401k) are intentionally absent.
 */
export type CertType =
  | 'SWIADECTWO_PRACY'
  | 'PIT_11'
  | 'ARBEITSZEUGNIS_SIMPLE'
  | 'LOHNSTEUERBESCHEINIGUNG'
  | 'P45'
  | 'W2';

/** One step in a per-market lifecycle template. */
export interface MarketTaskSeed {
  /** English title of the step (DRAFT template data; org-editable). */
  title: string;
  description?: string;
  /** WorkflowTaskType member (MANUAL | DOCUMENT_COLLECTION | NOTIFICATION | …). */
  taskType: 'MANUAL' | 'DOCUMENT_COLLECTION' | 'NOTIFICATION';
  sortOrder: number;
  required: boolean;
  /** Marks a step backed by a gov-integration stub seam (completed manually). */
  govStub?: GovStubKind;
  /** Marks a step that emits a draft statutory certificate. */
  certType?: CertType;
  /** Statutory step that needs jurisdiction legal/tax adviser verification. */
  adviserVerify?: boolean;
}

/** A per-market onboarding OR offboarding template seed. */
export interface MarketTemplateSeed {
  jurisdiction: Jurisdiction;
  type: LifecycleType;
  /** Stable per-market seed identity for the idempotent boot upsert. */
  seedKey: string;
  /** Template display name (DRAFT; org-editable). */
  name: string;
  tasks: MarketTaskSeed[];
}
