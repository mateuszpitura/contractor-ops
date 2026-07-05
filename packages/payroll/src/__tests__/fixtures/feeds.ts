// Shared synthetic PayrollFeed fixtures for the golden-fixture round-trip tests.
//
// Values are entirely synthetic (no real PESEL / SSN / SV-Nr / NINO). National
// identifiers appear only as `nationalIdLast4` (PL/US) or inside `countryFields`
// as market references (DE svNummer / steuerIdNr, GB niNumber) — matching the
// PII-masked feed the API feed-builder produces.

import type { PayrollFeed } from '../../types/feed.js';

const GENERATED_AT = '2026-07-05T00:00:00.000Z';

export const plFeed: PayrollFeed = {
  organizationId: 'org-pl-0001',
  generatedAt: GENERATED_AT,
  targetCountry: 'PL',
  employees: [
    {
      workerId: 'wrk-pl-001',
      displayName: 'Anna Kowalska',
      email: 'anna.kowalska@example.pl',
      countryCode: 'PL',
      hireDate: '2024-01-15',
      terminatedAt: null,
      employmentStatus: 'ACTIVE',
      etat: '1.00',
      nationalIdLast4: '3210',
      countryFields: {
        stanowisko: 'Programista',
        urzadSkarbowyCode: '1471',
        zusTitleCode: '011000',
        nfzOddzial: '07',
        stawkaBrutto: '8500.00',
      },
    },
    {
      workerId: 'wrk-pl-002',
      displayName: 'Jan Nowak',
      email: null,
      countryCode: 'PL',
      hireDate: '2023-06-01',
      terminatedAt: '2025-03-31T00:00:00.000Z',
      employmentStatus: 'TERMINATED',
      etat: '0.50',
      nationalIdLast4: '7654',
      countryFields: {
        stanowisko: 'Analityk',
        urzadSkarbowyCode: '1449',
        zusTitleCode: '011000',
        nfzOddzial: '13',
        stawkaBrutto: '4250.00',
      },
    },
  ],
};

export const deFeed: PayrollFeed = {
  organizationId: 'org-de-0001',
  generatedAt: GENERATED_AT,
  targetCountry: 'DE',
  employees: [
    {
      workerId: 'wrk-de-001',
      displayName: 'Max Müller',
      email: 'max.mueller@example.de',
      countryCode: 'DE',
      hireDate: '2024-02-01',
      terminatedAt: null,
      employmentStatus: 'ACTIVE',
      etat: '1.00',
      nationalIdLast4: null,
      countryFields: {
        lohnsteuerklasse: '1',
        kirchensteuer: 'ev',
        steuerIdNr: '12345678901',
        svNummer: '65123456M789',
        krankenkasse: 'TK',
        kinderfreibetrag: '0.5',
      },
    },
    {
      workerId: 'wrk-de-002',
      displayName: 'Erika Schaefer',
      email: 'erika.schaefer@example.de',
      countryCode: 'DE',
      hireDate: '2022-09-15',
      terminatedAt: null,
      employmentStatus: 'ACTIVE',
      etat: '0.75',
      nationalIdLast4: null,
      countryFields: {
        lohnsteuerklasse: '3',
        kirchensteuer: 'rk',
        steuerIdNr: '98765432109',
        svNummer: '65987654F321',
        krankenkasse: 'AOK',
        kinderfreibetrag: '2.0',
      },
    },
  ],
};

export const gbFeed: PayrollFeed = {
  organizationId: 'org-gb-0001',
  generatedAt: GENERATED_AT,
  targetCountry: 'GB',
  employees: [
    {
      workerId: 'wrk-gb-001',
      displayName: 'John Smith',
      email: 'john.smith@example.co.uk',
      countryCode: 'GB',
      hireDate: '2024-04-06',
      terminatedAt: null,
      employmentStatus: 'ACTIVE',
      etat: '1.00',
      nationalIdLast4: null,
      countryFields: {
        taxCode: '1257L',
        studentLoanPlan: 'PLAN2',
        niNumber: 'AB123456C',
        payeReference: '123/AB456',
        pensionEnrolled: true,
      },
    },
    {
      workerId: 'wrk-gb-002',
      displayName: 'Jane Doe',
      email: 'jane.doe@example.co.uk',
      countryCode: 'GB',
      hireDate: '2023-11-01',
      terminatedAt: null,
      employmentStatus: 'ACTIVE',
      etat: '0.60',
      nationalIdLast4: null,
      countryFields: {
        taxCode: 'BR',
        studentLoanPlan: 'NONE',
        niNumber: 'CD789012D',
        payeReference: '123/AB456',
        pensionEnrolled: false,
      },
    },
  ],
};

export const usFeed: PayrollFeed = {
  organizationId: 'org-us-0001',
  generatedAt: GENERATED_AT,
  targetCountry: 'US',
  employees: [
    {
      workerId: 'wrk-us-001',
      displayName: 'Michael Brown',
      email: 'michael.brown@example.com',
      countryCode: 'US',
      hireDate: '2024-03-01',
      terminatedAt: null,
      employmentStatus: 'ACTIVE',
      etat: '1.00',
      nationalIdLast4: '1234',
      countryFields: {
        filingStatus: 'SINGLE',
        stateWithholding: 'CA',
        stateOther: '',
      },
    },
    {
      workerId: 'wrk-us-002',
      displayName: 'Emily Davis',
      email: 'emily.davis@example.com',
      countryCode: 'US',
      hireDate: '2023-07-15',
      terminatedAt: null,
      employmentStatus: 'ACTIVE',
      etat: '1.00',
      nationalIdLast4: '5678',
      countryFields: {
        filingStatus: 'MARRIED',
        stateWithholding: 'NY',
        stateOther: 'NJ',
      },
    },
  ],
};
