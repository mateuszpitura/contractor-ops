import { describe, expect, it } from 'vitest';
import { createOrganizationSchema, updateOrganizationSettingsSchema } from '../organization.js';

describe('createOrganizationSchema', () => {
  it('accepts valid org bootstrap', () => {
    const r = createOrganizationSchema.safeParse({
      name: 'Acme',
      countryCode: 'PL',
      defaultCurrency: 'PLN',
      timezone: 'Europe/Warsaw',
    });
    expect(r.success).toBe(true);
  });

  it('rejects short name', () => {
    const r = createOrganizationSchema.safeParse({
      name: 'A',
      countryCode: 'PL',
      defaultCurrency: 'PLN',
      timezone: 'UTC',
    });
    expect(r.success).toBe(false);
  });

  it('rejects wrong country code length', () => {
    const r = createOrganizationSchema.safeParse({
      name: 'Acme',
      countryCode: 'POL',
      defaultCurrency: 'PLN',
      timezone: 'UTC',
    });
    expect(r.success).toBe(false);
  });
});

describe('updateOrganizationSettingsSchema', () => {
  it('allows partial updates', () => {
    const r = updateOrganizationSettingsSchema.safeParse({
      language: 'en',
      billingEmail: 'billing@example.com',
    });
    expect(r.success).toBe(true);
  });

  it.each(['pl', 'en', 'ar', 'de'] as const)('accepts language %s', language => {
    const r = updateOrganizationSettingsSchema.safeParse({ language });
    expect(r.success).toBe(true);
  });

  it('rejects unsupported language', () => {
    const r = updateOrganizationSettingsSchema.safeParse({ language: 'fr' });
    expect(r.success).toBe(false);
  });

  it('caps onboarding steps array', () => {
    const steps = Array.from({ length: 11 }, (_, i) => `step${i}`);
    const r = updateOrganizationSettingsSchema.safeParse({
      onboardingCompletedSteps: steps,
    });
    expect(r.success).toBe(false);
  });
});
