// Phase 74 Plan 02 — 4 KT seed templates per CONTEXT.md D-04 (6-9 task items
// each per CONTEXT.md SC#1). Sourced from 74-RESEARCH.md § Code Examples >
// "4 KT Seed Templates (D-04 — Researcher-drafted)" with one extension to
// Generic Consultant (added `contactDirectory` task) so all four seeds satisfy
// SC#1's 6-9 task-items invariant.
//
// Plan 75 will hook IP_ASSIGNMENT into the `requiredDocs` arrays where each
// seed currently declares HANDOVER_DOCUMENT.

import type { Seed } from './types.js';

export const OFFBOARDING_TEMPLATE_SEEDS: readonly Seed[] = [
  {
    role: 'software_engineer',
    displayNameI18nKey: 'Offboarding.Templates.SoftwareEngineer.displayName',
    taskItems: [
      {
        titleI18nKey: 'Offboarding.Templates.SoftwareEngineer.handoverDocs.title',
        descriptionI18nKey: 'Offboarding.Templates.SoftwareEngineer.handoverDocs.description',
        dueDayOffset: 0,
      },
      {
        titleI18nKey: 'Offboarding.Templates.SoftwareEngineer.codeWalkthrough.title',
        descriptionI18nKey: 'Offboarding.Templates.SoftwareEngineer.codeWalkthrough.description',
        dueDayOffset: 1,
      },
      {
        titleI18nKey: 'Offboarding.Templates.SoftwareEngineer.openPRs.title',
        descriptionI18nKey: 'Offboarding.Templates.SoftwareEngineer.openPRs.description',
        dueDayOffset: 2,
      },
      {
        titleI18nKey: 'Offboarding.Templates.SoftwareEngineer.deploymentRunbook.title',
        descriptionI18nKey: 'Offboarding.Templates.SoftwareEngineer.deploymentRunbook.description',
        dueDayOffset: 3,
      },
      {
        titleI18nKey: 'Offboarding.Templates.SoftwareEngineer.onCallRotation.title',
        descriptionI18nKey: 'Offboarding.Templates.SoftwareEngineer.onCallRotation.description',
        dueDayOffset: 4,
      },
      {
        titleI18nKey: 'Offboarding.Templates.SoftwareEngineer.architectureNotes.title',
        descriptionI18nKey: 'Offboarding.Templates.SoftwareEngineer.architectureNotes.description',
        dueDayOffset: 5,
      },
      {
        titleI18nKey: 'Offboarding.Templates.SoftwareEngineer.knownIssues.title',
        descriptionI18nKey: 'Offboarding.Templates.SoftwareEngineer.knownIssues.description',
        dueDayOffset: 5,
        requiredDocs: ['HANDOVER_DOCUMENT'], // Phase 75 hooks IP_ASSIGNMENT here for SE
      },
    ],
  },
  {
    role: 'designer',
    displayNameI18nKey: 'Offboarding.Templates.Designer.displayName',
    taskItems: [
      {
        titleI18nKey: 'Offboarding.Templates.Designer.designSystemHandover.title',
        descriptionI18nKey: 'Offboarding.Templates.Designer.designSystemHandover.description',
        dueDayOffset: 0,
      },
      {
        titleI18nKey: 'Offboarding.Templates.Designer.figmaTransfer.title',
        descriptionI18nKey: 'Offboarding.Templates.Designer.figmaTransfer.description',
        dueDayOffset: 1,
      },
      {
        titleI18nKey: 'Offboarding.Templates.Designer.assetLibraryAccess.title',
        descriptionI18nKey: 'Offboarding.Templates.Designer.assetLibraryAccess.description',
        dueDayOffset: 2,
      },
      {
        titleI18nKey: 'Offboarding.Templates.Designer.activeProjects.title',
        descriptionI18nKey: 'Offboarding.Templates.Designer.activeProjects.description',
        dueDayOffset: 3,
      },
      {
        titleI18nKey: 'Offboarding.Templates.Designer.brandGuidelinesUpdate.title',
        descriptionI18nKey: 'Offboarding.Templates.Designer.brandGuidelinesUpdate.description',
        dueDayOffset: 4,
      },
      {
        titleI18nKey: 'Offboarding.Templates.Designer.researchArchive.title',
        descriptionI18nKey: 'Offboarding.Templates.Designer.researchArchive.description',
        dueDayOffset: 5,
        requiredDocs: ['HANDOVER_DOCUMENT'],
      },
    ],
  },
  {
    role: 'product_manager',
    displayNameI18nKey: 'Offboarding.Templates.ProductManager.displayName',
    taskItems: [
      {
        titleI18nKey: 'Offboarding.Templates.ProductManager.roadmapTransfer.title',
        descriptionI18nKey: 'Offboarding.Templates.ProductManager.roadmapTransfer.description',
        dueDayOffset: 0,
      },
      {
        titleI18nKey: 'Offboarding.Templates.ProductManager.stakeholderIntros.title',
        descriptionI18nKey: 'Offboarding.Templates.ProductManager.stakeholderIntros.description',
        dueDayOffset: 1,
      },
      {
        titleI18nKey: 'Offboarding.Templates.ProductManager.activeInitiatives.title',
        descriptionI18nKey: 'Offboarding.Templates.ProductManager.activeInitiatives.description',
        dueDayOffset: 2,
      },
      {
        titleI18nKey: 'Offboarding.Templates.ProductManager.metricsContext.title',
        descriptionI18nKey: 'Offboarding.Templates.ProductManager.metricsContext.description',
        dueDayOffset: 3,
      },
      {
        titleI18nKey: 'Offboarding.Templates.ProductManager.researchInsights.title',
        descriptionI18nKey: 'Offboarding.Templates.ProductManager.researchInsights.description',
        dueDayOffset: 4,
      },
      {
        titleI18nKey: 'Offboarding.Templates.ProductManager.vendorRelationships.title',
        descriptionI18nKey: 'Offboarding.Templates.ProductManager.vendorRelationships.description',
        dueDayOffset: 5,
        requiredDocs: ['HANDOVER_DOCUMENT'],
      },
    ],
  },
  {
    role: 'generic_consultant',
    displayNameI18nKey: 'Offboarding.Templates.GenericConsultant.displayName',
    taskItems: [
      {
        titleI18nKey: 'Offboarding.Templates.GenericConsultant.handoverDocs.title',
        descriptionI18nKey: 'Offboarding.Templates.GenericConsultant.handoverDocs.description',
        dueDayOffset: 0,
      },
      {
        titleI18nKey: 'Offboarding.Templates.GenericConsultant.activeProjectStatus.title',
        descriptionI18nKey:
          'Offboarding.Templates.GenericConsultant.activeProjectStatus.description',
        dueDayOffset: 1,
      },
      {
        titleI18nKey: 'Offboarding.Templates.GenericConsultant.clientStakeholderHandover.title',
        descriptionI18nKey:
          'Offboarding.Templates.GenericConsultant.clientStakeholderHandover.description',
        dueDayOffset: 2,
      },
      {
        titleI18nKey: 'Offboarding.Templates.GenericConsultant.deliverableArchive.title',
        descriptionI18nKey:
          'Offboarding.Templates.GenericConsultant.deliverableArchive.description',
        dueDayOffset: 3,
      },
      {
        titleI18nKey: 'Offboarding.Templates.GenericConsultant.knowledgeRepoIndex.title',
        descriptionI18nKey:
          'Offboarding.Templates.GenericConsultant.knowledgeRepoIndex.description',
        dueDayOffset: 4,
        requiredDocs: ['HANDOVER_DOCUMENT'],
      },
      // Plan 74-02 Task 1 added this 6th item so the seed satisfies CONTEXT.md SC#1
      // (6-9 task items per template). Researcher's draft only had 5 items.
      {
        titleI18nKey: 'Offboarding.Templates.GenericConsultant.contactDirectory.title',
        descriptionI18nKey: 'Offboarding.Templates.GenericConsultant.contactDirectory.description',
        dueDayOffset: 5,
      },
    ],
  },
] as const;
