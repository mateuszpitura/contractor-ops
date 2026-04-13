// Phase 57 · Plan 01 — VIES USt-IdNr fixtures (PAY-05).

export const VIES_SIMPLE_VALID_200 = (countryCode: string, vatNumber: string) => ({
  countryCode,
  vatNumber,
  requestDate: '2026-04-12',
  isValid: true,
  name: 'Test GmbH',
  address: 'Hauptstraße 1, 10115 Berlin',
});

export const VIES_QUALIFIED_200 = (countryCode: string, vatNumber: string) => ({
  ...VIES_SIMPLE_VALID_200(countryCode, vatNumber),
  requestIdentifier: 'WAPIAAAAXEZNM9VJ',
  traderName: 'Test GmbH',
  traderStreetMatch: '1' as const,
  traderPostcodeMatch: '1' as const,
  traderCityMatch: '1' as const,
});

export const VIES_INVALID_200 = (countryCode: string, vatNumber: string) => ({
  countryCode,
  vatNumber,
  requestDate: '2026-04-12',
  isValid: false,
});

export const VIES_MS_UNAVAILABLE = (countryCode: string, vatNumber: string) => ({
  countryCode,
  vatNumber,
  userError: 'MS_UNAVAILABLE' as const,
});
