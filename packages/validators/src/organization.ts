import { z } from 'zod';

/**
 * Schema for creating a new organization during sign-up.
 * Captures the minimum required info to set up the organization.
 */
export const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(255),
  countryCode: z
    .string()
    .length(2, 'Country code must be exactly 2 characters (ISO 3166-1 alpha-2)'),
  defaultCurrency: z.string().length(3, 'Currency code must be exactly 3 characters (ISO 4217)'),
  timezone: z.string().min(1, 'Timezone is required'),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

/**
 * Schema for updating organization settings.
 * All fields are optional — only provided fields are updated.
 */
export const dateFormatValues = [
  'DD/MM/YYYY',
  'MM/DD/YYYY',
  'YYYY-MM-DD',
  'DD.MM.YYYY',
  'DD MMM YYYY',
] as const;

export type DateFormatKey = (typeof dateFormatValues)[number];

export const timeFormatValues = ['24h', '12h'] as const;

export type TimeFormatKey = (typeof timeFormatValues)[number];

export const updateOrganizationSettingsSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  legalName: z.string().max(255).optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
  billingEmail: z.string().email('Invalid billing email').optional(),
  language: z.enum(['pl', 'en', 'ar', 'de']).optional(),
  dateFormat: z.enum(dateFormatValues).optional(),
  timeFormat: z.enum(timeFormatValues).optional(),
  onboardingCompletedSteps: z.array(z.string().min(1).max(50)).max(10).optional(),
  onboardingDismissed: z.boolean().optional(),
  defaultReturnCarrier: z.string().max(20).optional(),
});

export type UpdateOrganizationSettingsInput = z.infer<typeof updateOrganizationSettingsSchema>;
