// Phase 74 Plan 01 — Wave 0 typed exports for the offboarding KT-template package.
//
// Source of truth: 74-01-PLAN.md `<interfaces>` block.
// Plan 74-02 fills the OFFBOARDING_TEMPLATE_SEEDS / PTO_KEYWORDS constants,
// Plan 74-05 fills `upsertSeedTemplates`, Plan 75 extends DocumentType.

export type OffboardingTemplateSeedRole =
  | 'software_engineer'
  | 'designer'
  | 'product_manager'
  | 'generic_consultant';

/**
 * Public alias used by downstream plans that prefer a shorter name (Plan 74-05
 * tRPC CRUD layer, Plan 74-07 settings UI). Intentionally identical to
 * `OffboardingTemplateSeedRole` — not a separate type.
 */
export type Role = OffboardingTemplateSeedRole;

export type DocumentType = 'HANDOVER_DOCUMENT'; // Phase 75 will extend with IP_ASSIGNMENT etc.

export interface TaskItem {
  readonly titleI18nKey: string;
  readonly descriptionI18nKey: string;
  readonly dueDayOffset: number; // days from offboarding-start
  readonly requiredDocs?: readonly DocumentType[];
}

export interface Seed {
  readonly role: OffboardingTemplateSeedRole;
  readonly displayNameI18nKey: string;
  readonly taskItems: readonly TaskItem[];
}

export type SupportedLocale = 'en' | 'pl' | 'de';
export type PtoKeywords = Readonly<Record<SupportedLocale, readonly string[]>>;
