import type { InvitableMemberRole } from '@contractor-ops/validators/roles';

/**
 * Shared selection types consumed by step containers and hooks.
 *
 * The wizard composition itself now lives in `onboarding-import-container.tsx`
 * (the only decisive container that owns step state + side-effect setup). This
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
