/**
 * Factories for dataport.pl `/api/v1/company/{nip}` JSON responses.
 *
 * Shape mirrors the documented dataport response contract — adjust if the
 * upstream API evolves.
 */
export const dataportFixtures = {
  /** Happy-path: a fully-populated PL sole trader. */
  happyPath: () => ({
    nip: '5260250995',
    regon: '012345678',
    legalName: 'Ministerstwo Finansów',
    name: 'Ministerstwo Finansów',
    status: 'ACTIVE',
    address: {
      street: 'Świętokrzyska',
      buildingNumber: '12',
      apartmentNumber: '',
      city: 'Warszawa',
      postalCode: '00-916',
      country: 'PL',
    },
  }),

  /** Minimal payload — name only, no address. */
  minimal: () => ({
    nip: '5260250995',
    regon: '012345678',
    name: 'Sample Sp. z o.o.',
    status: 'ACTIVE',
  }),
};
