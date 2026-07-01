import type { Jurisdiction, PersonnelFileSection } from '@contractor-ops/compliance-policy';
import { resolveSectionForDocumentType } from '@contractor-ops/compliance-policy';
import type { EvalResult, FlagKey } from '@contractor-ops/feature-flags';
import { evaluate } from '@contractor-ops/feature-flags';
import { createLogger } from '@contractor-ops/logger';

const log = createLogger({ service: 'personnel-classifier' });

/**
 * Document → personnel-file-section classifier.
 *
 * Hybrid routing, in priority order:
 *   1. Deterministic taxonomy — resolve the section straight from the
 *      (jurisdiction, documentType) map. A hit assigns the section with NO
 *      model call at all: most uploads land here.
 *   2. Kill-switch-gated AI fallback — only on a taxonomy miss. The kill-switch
 *      is evaluated BEFORE any Claude call; when it is off (or Unleash is
 *      unreachable, since the flag is killWhenUnknown) the document is routed
 *      to the admin classify-step instead of the model.
 *   3. Admin review — a below-threshold AI guess, or the kill-switch being off,
 *      routes to PENDING_REVIEW.
 *
 * The service NEVER blocks the upload and NEVER throws on a disabled/unreachable
 * kill-switch: the row is already persisted, so a failure to auto-classify must
 * degrade to the admin step, not an error. Special-category personnel PII only
 * reaches the model on this row's own org context — there is no cross-tenant
 * batching. Persisting the outcome and flipping the document status is the
 * caller's job; this service is pure routing plus the model call.
 */

const KILLSWITCH_KEY = 'killswitch.ai-personnel-classifier' as const satisfies FlagKey;

/**
 * Auto-assign thresholds. The AI guess is trusted only when the top section
 * clears the confidence floor AND leads the runner-up by the margin; anything
 * softer is ambiguous and goes to a human.
 */
export const PERSONNEL_CLASSIFY_MIN_CONFIDENCE = 85;
export const PERSONNEL_CLASSIFY_MIN_MARGIN = 15;

/**
 * The Prisma DocumentType catch-all. The section registry maps 'OTHER' to
 * SECTION_D per jurisdiction so every document still has a retention home, but
 * an uploader who declares a document as "Other" is declining to categorise it
 * — that is exactly the ambiguous tail the AI / admin step exists to resolve.
 * So the deterministic step treats 'OTHER' as no signal and falls through
 * rather than auto-filing it into SECTION_D on the uploader's behalf.
 */
const UNCLASSIFIED_DOCUMENT_TYPE = 'OTHER';

/** Short section code exposed to callers, mirroring the AI adapter's output. */
export type PersonnelSectionCode = 'A' | 'B' | 'C' | 'D';

export type PersonnelClassificationMethod = 'DETERMINISTIC' | 'AI' | 'PENDING';

export type PersonnelClassificationStatus = 'CLASSIFIED' | 'PENDING_REVIEW';

/** The kill-switch evaluation the classifier consumes (structurally an EvalResult). */
export interface PersonnelKillSwitchOutcome {
  enabled: boolean;
  reason: string;
}

/** One AI section guess: the top section plus its confidence and lead over the runner-up (0–100 scale). */
export interface PersonnelAiSectionGuess {
  section: PersonnelSectionCode;
  confidence: number;
  margin: number;
}

/**
 * Injected seams. Both the kill-switch evaluation and the Claude Vision call are
 * passed in so routing stays deterministic and PII-free in tests, and so the
 * caller owns the concrete model adapter + presign (mirroring the OCR path).
 */
export interface PersonnelClassifierSeams {
  evaluateKillSwitch: (context: {
    organizationId: string;
    region: 'EU' | 'ME' | 'US';
  }) => PersonnelKillSwitchOutcome | Promise<PersonnelKillSwitchOutcome>;
  classifyWithClaude: (input: {
    storageKey: string;
    jurisdiction: Jurisdiction;
    organizationId: string;
  }) => Promise<PersonnelAiSectionGuess>;
}

export interface ClassifyPersonnelDocumentParams {
  jurisdiction: Jurisdiction;
  documentType: string;
  storageKey: string;
  organizationId: string;
  region: 'EU' | 'ME' | 'US';
}

interface DeterministicClassification {
  classificationMethod: 'DETERMINISTIC';
  section: PersonnelSectionCode;
  status: 'CLASSIFIED';
  uploadBlocked: false;
}

interface AiClassification {
  classificationMethod: 'AI';
  section: PersonnelSectionCode;
  aiSectionGuess: PersonnelSectionCode;
  aiConfidence: number;
  status: 'CLASSIFIED';
  uploadBlocked: false;
}

interface PendingClassification {
  classificationMethod: 'PENDING';
  status: 'PENDING_REVIEW';
  uploadBlocked: false;
  aiSectionGuess?: PersonnelSectionCode;
  aiConfidence?: number;
}

export type PersonnelClassificationResult =
  | DeterministicClassification
  | AiClassification
  | PendingClassification;

/** SECTION_A..D → the short A..D code callers and the AI adapter speak. */
function toSectionCode(id: PersonnelFileSection): PersonnelSectionCode {
  return id.slice('SECTION_'.length) as PersonnelSectionCode;
}

/**
 * Production kill-switch seam: evaluates `killswitch.ai-personnel-classifier`
 * on the row's own org context. `evaluate` never throws — an unreachable
 * Unleash resolves to the killWhenUnknown (off) result — so the caller can wire
 * this directly and rely on the classifier degrading to the admin step.
 */
export function defaultEvaluateKillSwitch(context: {
  organizationId: string;
  region: 'EU' | 'ME' | 'US';
}): EvalResult {
  return evaluate(KILLSWITCH_KEY, {
    organizationId: context.organizationId,
    region: context.region,
  });
}

export async function classifyPersonnelDocument(
  params: ClassifyPersonnelDocumentParams,
  seams: PersonnelClassifierSeams,
): Promise<PersonnelClassificationResult> {
  // 1. Deterministic taxonomy — a hit short-circuits before the kill-switch and
  //    the model, so the common case never touches AI or the flag backend. An
  //    'OTHER'-typed upload is skipped here so the ambiguous tail reaches the
  //    AI / admin step instead of being auto-filed into the SECTION_D catch-all.
  const deterministic =
    params.documentType === UNCLASSIFIED_DOCUMENT_TYPE
      ? null
      : resolveSectionForDocumentType(params.jurisdiction, params.documentType);
  if (deterministic !== null) {
    return {
      classificationMethod: 'DETERMINISTIC',
      section: toSectionCode(deterministic.id),
      status: 'CLASSIFIED',
      uploadBlocked: false,
    };
  }

  // 2. Kill-switch gate — evaluated before any Claude call. Off/unreachable
  //    routes special-category PII to the admin step rather than the model.
  const killSwitch = await seams.evaluateKillSwitch({
    organizationId: params.organizationId,
    region: params.region,
  });
  if (!killSwitch.enabled) {
    log.info(
      { organizationId: params.organizationId, reason: killSwitch.reason },
      'personnel classifier: kill-switch off — routing upload to admin review',
    );
    return { classificationMethod: 'PENDING', status: 'PENDING_REVIEW', uploadBlocked: false };
  }

  // 3. AI fallback — single-org context, no cross-tenant batching.
  const guess = await seams.classifyWithClaude({
    storageKey: params.storageKey,
    jurisdiction: params.jurisdiction,
    organizationId: params.organizationId,
  });

  const clearsThreshold =
    guess.confidence >= PERSONNEL_CLASSIFY_MIN_CONFIDENCE &&
    guess.margin >= PERSONNEL_CLASSIFY_MIN_MARGIN;

  if (clearsThreshold) {
    return {
      classificationMethod: 'AI',
      section: guess.section,
      aiSectionGuess: guess.section,
      aiConfidence: guess.confidence,
      status: 'CLASSIFIED',
      uploadBlocked: false,
    };
  }

  log.info(
    {
      organizationId: params.organizationId,
      aiSectionGuess: guess.section,
      aiConfidence: guess.confidence,
    },
    'personnel classifier: AI guess below threshold — routing upload to admin review',
  );
  return {
    classificationMethod: 'PENDING',
    status: 'PENDING_REVIEW',
    uploadBlocked: false,
    aiSectionGuess: guess.section,
    aiConfidence: guess.confidence,
  };
}
