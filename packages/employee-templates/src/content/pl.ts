import { registerMarketTemplates } from '../registry';

// Poland (PL) — Kodeks pracy employee on/offboarding. Statutory steps carry
// adviserVerify (local-only, legal deferred); cert steps emit a draft PDF and
// gov steps are backed by a network-free stub the HR user completes by hand.
registerMarketTemplates(
  {
    jurisdiction: 'PL',
    type: 'ONBOARDING',
    seedKey: 'pl-onboarding',
    name: 'Employee onboarding — Poland',
    tasks: [
      {
        title: 'Badania wstępne (pre-employment medical examination)',
        description:
          'Employee completes the mandatory badania wstępne (pre-employment occupational medical exam); file the orzeczenie lekarskie before the first working day.',
        taskType: 'MANUAL',
        sortOrder: 0,
        required: true,
        adviserVerify: true,
      },
      {
        title: 'PIT-2 declaration',
        description:
          'Collect the signed PIT-2 so the tax-free amount is applied to monthly advances.',
        taskType: 'DOCUMENT_COLLECTION',
        sortOrder: 1,
        required: true,
        adviserVerify: true,
      },
      {
        title: 'PPK auto-enrolment (auto-zapis)',
        description:
          'Auto-enrol the employee into the Pracownicze Plany Kapitałowe scheme unless a valid opt-out is on file.',
        taskType: 'MANUAL',
        sortOrder: 2,
        required: true,
        adviserVerify: true,
      },
      {
        title: 'IKE / IKZE information',
        description: 'Notify the employee of optional IKE/IKZE retirement-saving options.',
        taskType: 'NOTIFICATION',
        sortOrder: 3,
        required: false,
      },
    ],
  },
  {
    jurisdiction: 'PL',
    type: 'OFFBOARDING',
    seedKey: 'pl-offboarding',
    name: 'Employee offboarding — Poland',
    tasks: [
      {
        title: 'Świadectwo pracy (certificate of employment)',
        description:
          'Generate and issue the świadectwo pracy within the statutory deadline. Draft PDF — needs adviser verification before issue.',
        taskType: 'MANUAL',
        sortOrder: 0,
        required: true,
        certType: 'SWIADECTWO_PRACY',
        adviserVerify: true,
      },
      {
        title: 'Ekwiwalent za urlop (unused-leave equivalent)',
        description:
          'Compute the cash equivalent for unused annual leave from the leave balance and include it in the final pay.',
        taskType: 'MANUAL',
        sortOrder: 1,
        required: true,
        adviserVerify: true,
      },
      {
        title: 'ZUS ZWUA deregistration',
        description:
          'Submit the ZUS ZWUA social-insurance deregistration. Backed by a stub seam — complete via PUE ZUS by hand.',
        taskType: 'MANUAL',
        sortOrder: 2,
        required: true,
        govStub: 'ZUS_ZWUA',
        adviserVerify: true,
      },
      {
        title: 'PIT-11 information return',
        description:
          'Generate the PIT-11 annual information return. Draft PDF — needs adviser verification before issue.',
        taskType: 'MANUAL',
        sortOrder: 3,
        required: true,
        certType: 'PIT_11',
        adviserVerify: true,
      },
    ],
  },
);
