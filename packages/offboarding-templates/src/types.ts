// Typed exports for the offboarding KT-template package.

export type OffboardingTemplateSeedRole =
  | 'software_engineer'
  | 'designer'
  | 'product_manager'
  | 'generic_consultant';

/**
 * Public alias for consumers that prefer a shorter name. Intentionally
 * identical to `OffboardingTemplateSeedRole` — not a separate type.
 */
export type Role = OffboardingTemplateSeedRole;

export type DocumentType = 'HANDOVER_DOCUMENT'; // IP_ASSIGNMENT and other types will be added here

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
