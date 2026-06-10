import type { InvitableMemberRole } from '@contractor-ops/validators/roles';

/**
 * Shared selection types consumed by step containers and hooks.
 *
 * The wizard composition lives in `pages/dashboard/onboarding-import.tsx`
 * (`OnboardingImportPageContent` owns step state + side-effect setup). Step
 * wired views (`*StepContainer`) are co-located in their step modules. This
 * file is kept as the types module so existing imports of `PersonSelection`
 * and `ProjectSelection` continue to resolve.
 */

export interface PersonSelection {
  role: InvitableMemberRole;
  skip: boolean;
  resolvedConflicts: Record<string, string>;
}

export interface ProjectSelection {
  skip: boolean;
  name: string;
  steps: Array<{ name: string; sortOrder: number }>;
}

export type WizardStep = 1 | 2 | 3 | 4;
