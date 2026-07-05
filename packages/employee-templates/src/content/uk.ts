import { registerMarketTemplates } from '../registry';

// United Kingdom (UK) — PAYE employee on/offboarding. RTI steps are backed by a
// stub seam; P45 emits a draft PDF. P11D remains a manual step (cert deferred).
registerMarketTemplates(
  {
    jurisdiction: 'UK',
    type: 'ONBOARDING',
    seedKey: 'uk-onboarding',
    name: 'Employee onboarding — United Kingdom',
    tasks: [
      {
        title: 'P45 / P46 (starter checklist)',
        description: 'Collect the P45 from the previous employer or a completed starter checklist.',
        taskType: 'DOCUMENT_COLLECTION',
        sortOrder: 0,
        required: true,
        adviserVerify: true,
      },
      {
        title: 'HMRC RTI new-starter FPS',
        description:
          'Report the new starter to HMRC via a Full Payment Submission. Backed by a stub seam — complete via the RTI channel by hand.',
        taskType: 'MANUAL',
        sortOrder: 1,
        required: true,
        govStub: 'HMRC_RTI',
        adviserVerify: true,
      },
      {
        title: 'Pension auto-enrolment',
        description: 'Assess and auto-enrol the employee into the workplace pension scheme.',
        taskType: 'NOTIFICATION',
        sortOrder: 2,
        required: true,
        adviserVerify: true,
      },
    ],
  },
  {
    jurisdiction: 'UK',
    type: 'OFFBOARDING',
    seedKey: 'uk-offboarding',
    name: 'Employee offboarding — United Kingdom',
    tasks: [
      {
        title: 'P45 (leaver statement)',
        description:
          'Generate the P45 leaver statement. Draft PDF — needs adviser verification before issue.',
        taskType: 'MANUAL',
        sortOrder: 0,
        required: true,
        certType: 'P45',
        adviserVerify: true,
      },
      {
        title: 'Final HMRC RTI FPS (leaver)',
        description:
          'Report the leaver on the final Full Payment Submission. Backed by a stub seam — complete via the RTI channel by hand.',
        taskType: 'MANUAL',
        sortOrder: 1,
        required: true,
        govStub: 'HMRC_RTI',
        adviserVerify: true,
      },
      {
        title: 'Pension scheme cessation',
        description: 'Notify the pension provider of the leaver and stop contributions.',
        taskType: 'MANUAL',
        sortOrder: 2,
        required: true,
      },
      {
        title: 'P11D benefits return',
        description:
          'Record taxable benefits in kind for the P11D return (PDF generation deferred).',
        taskType: 'MANUAL',
        sortOrder: 3,
        required: false,
        adviserVerify: true,
      },
    ],
  },
);
