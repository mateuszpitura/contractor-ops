import { registerMarketTemplates } from '../registry';

// United States (US) — federal employee on/offboarding. I-9 + E-Verify is backed
// by a stub seam; W-2 emits a draft PDF. COBRA and 401(k) packets are deferred.
registerMarketTemplates(
  {
    jurisdiction: 'US',
    type: 'ONBOARDING',
    seedKey: 'us-onboarding',
    name: 'Employee onboarding — United States',
    tasks: [
      {
        title: 'Form W-4 (federal withholding)',
        description: 'Collect the completed federal Form W-4.',
        taskType: 'DOCUMENT_COLLECTION',
        sortOrder: 0,
        required: true,
        adviserVerify: true,
      },
      {
        title: 'Form I-9 + E-Verify',
        description:
          'Complete Form I-9 employment eligibility verification and run E-Verify. Backed by a stub seam — no live SSA/DHS channel is wired.',
        taskType: 'MANUAL',
        sortOrder: 1,
        required: true,
        govStub: 'I9_EVERIFY',
        adviserVerify: true,
      },
      {
        title: 'State withholding (state W-4)',
        description: 'Collect the applicable state withholding certificate.',
        taskType: 'DOCUMENT_COLLECTION',
        sortOrder: 2,
        required: true,
        adviserVerify: true,
      },
      {
        title: 'Direct-deposit authorization',
        description: 'Collect the direct-deposit authorization and bank details for payroll.',
        taskType: 'MANUAL',
        sortOrder: 3,
        required: true,
      },
    ],
  },
  {
    jurisdiction: 'US',
    type: 'OFFBOARDING',
    seedKey: 'us-offboarding',
    name: 'Employee offboarding — United States',
    tasks: [
      {
        title: 'Final paycheck (per state rules)',
        description:
          'Issue the final paycheck per the state final-pay deadline. Final-pay data feeds the payroll export.',
        taskType: 'MANUAL',
        sortOrder: 0,
        required: true,
        adviserVerify: true,
      },
      {
        title: 'COBRA continuation notice',
        description:
          'Send the COBRA continuation-of-coverage notice where applicable (packet generation deferred).',
        taskType: 'MANUAL',
        sortOrder: 1,
        required: false,
        adviserVerify: true,
      },
      {
        title: 'Form W-2 (wage and tax statement)',
        description: 'Generate the Form W-2. Draft PDF — needs adviser verification before issue.',
        taskType: 'MANUAL',
        sortOrder: 2,
        required: true,
        certType: 'W2',
        adviserVerify: true,
      },
      {
        title: '401(k) distribution options',
        description:
          'Notify the employee of 401(k) rollover/distribution options (packet deferred).',
        taskType: 'MANUAL',
        sortOrder: 3,
        required: false,
      },
    ],
  },
);
