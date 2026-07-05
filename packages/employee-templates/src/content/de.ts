import { registerMarketTemplates } from '../registry';

// Germany (DE) — employee on/offboarding. Steuer-ID lookup reuses the existing
// ELStAM stub (lookupElstam) rather than a new seam; cert steps emit a draft PDF.
registerMarketTemplates(
  {
    jurisdiction: 'DE',
    type: 'ONBOARDING',
    seedKey: 'de-onboarding',
    name: 'Employee onboarding — Germany',
    tasks: [
      {
        title: 'Personalfragebogen (personnel questionnaire)',
        description: 'Collect the completed Personalfragebogen and supporting documents.',
        taskType: 'DOCUMENT_COLLECTION',
        sortOrder: 0,
        required: true,
        adviserVerify: true,
      },
      {
        title: 'Steuer-ID (ELStAM) lookup',
        description:
          'Resolve the employee ELStAM wage-tax deduction features by Steuer-Identifikationsnummer via the ELStAM seam (stubbed — no live Finanzverwaltung channel).',
        taskType: 'MANUAL',
        sortOrder: 1,
        required: true,
        adviserVerify: true,
      },
      {
        title: 'SV-Ausweis (social-insurance ID)',
        description: 'Record the Sozialversicherungsausweis / SV-Nummer for payroll registration.',
        taskType: 'MANUAL',
        sortOrder: 2,
        required: true,
        adviserVerify: true,
      },
      {
        title: 'bAV (occupational pension) offer',
        description: 'Notify the employee of the betriebliche Altersvorsorge entitlement.',
        taskType: 'NOTIFICATION',
        sortOrder: 3,
        required: false,
      },
    ],
  },
  {
    jurisdiction: 'DE',
    type: 'OFFBOARDING',
    seedKey: 'de-offboarding',
    name: 'Employee offboarding — Germany',
    tasks: [
      {
        title: 'Arbeitszeugnis (simple reference)',
        description:
          'Generate a simple Arbeitszeugnis. Draft PDF — needs adviser verification before issue. The qualified (free-text) Arbeitszeugnis is deferred.',
        taskType: 'MANUAL',
        sortOrder: 0,
        required: true,
        certType: 'ARBEITSZEUGNIS_SIMPLE',
        adviserVerify: true,
      },
      {
        title: 'Abmeldung SV (social-insurance deregistration)',
        description:
          'Submit the DEÜV Abmeldung. Backed by a stub seam — complete via the payroll channel by hand.',
        taskType: 'MANUAL',
        sortOrder: 1,
        required: true,
        govStub: 'ABMELDUNG_SV',
        adviserVerify: true,
      },
      {
        title: 'Lohnsteuerbescheinigung (wage-tax statement)',
        description:
          'Generate the Lohnsteuerbescheinigung. Draft PDF — needs adviser verification before issue.',
        taskType: 'MANUAL',
        sortOrder: 2,
        required: true,
        certType: 'LOHNSTEUERBESCHEINIGUNG',
        adviserVerify: true,
      },
    ],
  },
);
