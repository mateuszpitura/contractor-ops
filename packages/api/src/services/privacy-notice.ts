/**
 * Privacy notice service — jurisdiction-specific privacy notices.
 *
 * Per D-01: Privacy notices are jurisdiction-specific (UAE Federal Decree-Law
 * No. 45/2021, Saudi Royal Decree M/19 PDPL).
 *
 * Phase 56 Plan 07 extends the service with UK GDPR (GB), German GDPR/BDSG (DE)
 * and a generic EU GDPR fallback. Each org gets a versioned notice per
 * jurisdiction. GB/DE/EU static content is imported from
 * `@contractor-ops/validators` so MDX pages, React-PDF templates and the
 * service share a single source of truth (prevents content drift).
 */

import { prisma } from '@contractor-ops/db';
import type { SupportedJurisdiction as SupportedJurisdictionImpl } from '@contractor-ops/validators';
import {
  dePrivacyNotice,
  euPrivacyNotice,
  gbPrivacyNotice,
  resolveJurisdiction as resolveJurisdictionImpl,
} from '@contractor-ops/validators';
import { CacheTTL, cached, cacheKey } from './cache.js';

// Re-export the pure jurisdiction resolver from validators so existing callers
// that import from this service continue to work. Client components should
// import directly from `@contractor-ops/validators` to avoid the Prisma side
// effect of this module (D-09 fallback rule).
export const resolveJurisdiction = resolveJurisdictionImpl;
export type SupportedJurisdiction = SupportedJurisdictionImpl;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrivacyNoticeContent {
  jurisdiction: string;
  legalReference: string;
  controller: {
    name: string;
    country: string;
  };
  sections: {
    title: string;
    content: string;
  }[];
}

const SUPPORTED_JURISDICTIONS = new Set<SupportedJurisdiction>(['AE', 'SA', 'GB', 'DE', 'EU']);

// ---------------------------------------------------------------------------
// Default notice content per jurisdiction
// ---------------------------------------------------------------------------

export function getDefaultNoticeContent(
  jurisdiction: SupportedJurisdiction,
): Omit<PrivacyNoticeContent, 'controller'> {
  if (jurisdiction === 'GB') {
    return {
      jurisdiction: gbPrivacyNotice.jurisdiction,
      legalReference: gbPrivacyNotice.legalReference,
      sections: gbPrivacyNotice.sections.map(s => ({
        title: s.title,
        content: s.content,
      })),
    };
  }

  if (jurisdiction === 'DE') {
    return {
      jurisdiction: dePrivacyNotice.jurisdiction,
      legalReference: dePrivacyNotice.legalReference,
      sections: dePrivacyNotice.sections.map(s => ({
        title: s.title,
        content: s.content,
      })),
    };
  }

  if (jurisdiction === 'EU') {
    return {
      jurisdiction: euPrivacyNotice.jurisdiction,
      legalReference: euPrivacyNotice.legalReference,
      sections: euPrivacyNotice.sections.map(s => ({
        title: s.title,
        content: s.content,
      })),
    };
  }

  if (jurisdiction === 'AE') {
    return {
      jurisdiction: 'AE',
      legalReference: 'UAE Federal Decree-Law No. 45/2021 on the Protection of Personal Data',
      sections: [
        {
          title: 'Data Controller',
          content:
            'The organization identified below is the data controller responsible for the processing of your personal data.',
        },
        {
          title: 'Purposes of Processing',
          content:
            'We process your personal data for the following purposes: contractor data management, invoice and payment processing, analytics and reporting, integration data sharing, and communications. Each purpose requires your specific consent.',
        },
        {
          title: 'Legal Basis',
          content:
            'Processing is based on your explicit consent as required by Article 5 of Federal Decree-Law No. 45/2021. You may withdraw consent at any time without affecting the lawfulness of processing prior to withdrawal.',
        },
        {
          title: 'Data Categories',
          content:
            'We process: identity information (name, email, contact details), financial information (bank details, tax identifiers, invoices), professional information (contracts, work history, skills), and usage data (platform interactions, preferences).',
        },
        {
          title: 'Data Transfers',
          content:
            'Your data may be transferred outside the UAE if necessary for service delivery. Such transfers are protected by standard contractual clauses or other appropriate safeguards as required by the UAE Data Office.',
        },
        {
          title: 'Retention',
          content:
            'Personal data is retained for the duration of the contractual relationship plus the legally required retention period. Financial records are retained for the period required by applicable tax and commercial laws.',
        },
        {
          title: 'Your Rights',
          content:
            'Under Federal Decree-Law No. 45/2021, you have the right to: access your personal data, correct inaccurate data, request deletion, restrict processing, data portability, and object to processing. To exercise these rights, contact your organization administrator.',
        },
        {
          title: 'Contact',
          content:
            'For privacy inquiries, contact your organization administrator or the designated privacy officer.',
        },
      ],
    };
  }

  // Saudi Arabia (SA)
  return {
    jurisdiction: 'SA',
    legalReference: 'Kingdom of Saudi Arabia Personal Data Protection Law (Royal Decree M/19)',
    sections: [
      {
        title: 'Data Controller',
        content:
          'The organization identified below is the data controller responsible for the processing of your personal data in accordance with the Saudi PDPL.',
      },
      {
        title: 'Purposes of Processing',
        content:
          'We process your personal data for the following purposes: contractor data management, invoice and payment processing, analytics and reporting, integration data sharing, and communications. Each purpose requires your specific, informed consent.',
      },
      {
        title: 'Legal Basis',
        content:
          'Processing is based on your explicit consent as required by Article 6 of the Personal Data Protection Law (Royal Decree M/19). Consent must be freely given, specific, informed, and unambiguous. You may withdraw consent at any time.',
      },
      {
        title: 'Data Categories',
        content:
          'We process: identity information (name, email, contact details, national ID), financial information (bank details, tax identifiers, invoices), professional information (contracts, work history, Freelance.sa license, commercial registration), and usage data.',
      },
      {
        title: 'Data Transfers',
        content:
          'Your data may be transferred outside the Kingdom of Saudi Arabia if necessary for service delivery. Such transfers comply with SDAIA transfer requirements and are protected by standard contractual clauses or adequacy determinations.',
      },
      {
        title: 'Retention',
        content:
          'Personal data is retained for the duration of the contractual relationship plus the legally required retention period. The controller will destroy personal data when the purpose of collection ends, unless retention is required by law.',
      },
      {
        title: 'Your Rights',
        content:
          'Under the Saudi PDPL, you have the right to: be informed about processing, access your personal data, correct inaccurate data, request destruction, data portability, and object to processing. To exercise these rights, contact your organization administrator or the Data Protection Officer.',
      },
      {
        title: 'Data Protection Officer',
        content:
          'Organizations processing personal data under Saudi PDPL are required to appoint a Data Protection Officer. Contact details are available from your organization administrator.',
      },
      {
        title: 'Contact',
        content:
          'For privacy inquiries, contact your organization administrator or the designated Data Protection Officer.',
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Get the latest privacy notice for an organization's jurisdiction.
 * Creates from default template if none exists.
 */
export async function getPrivacyNotice(
  organizationId: string,
  jurisdiction: string,
): Promise<PrivacyNoticeContent | null> {
  if (!SUPPORTED_JURISDICTIONS.has(jurisdiction as SupportedJurisdiction)) {
    return null;
  }
  const typedJurisdiction = jurisdiction as SupportedJurisdiction;

  const key = cacheKey(organizationId, 'consent', 'notice', jurisdiction);

  return cached(key, CacheTTL.ORG_SETTINGS, async () => {
    // Find existing notice
    const existing = await prisma.privacyNotice.findFirst({
      where: { organizationId, jurisdiction },
      orderBy: { version: 'desc' },
    });

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true, countryCode: true },
    });

    if (existing) {
      const content = existing.contentJson as Omit<PrivacyNoticeContent, 'controller'>;
      return {
        ...content,
        controller: {
          name: org.name,
          country: org.countryCode ?? jurisdiction,
        },
      };
    }

    // Create default notice (GB/DE/EU/AE/SA — guarded by SUPPORTED_JURISDICTIONS above)
    const defaultContent = getDefaultNoticeContent(typedJurisdiction);
    await prisma.privacyNotice.create({
      data: {
        organizationId,
        jurisdiction,
        version: 1,
        contentJson: defaultContent as unknown as Record<string, unknown>,
        effectiveFrom: new Date(),
      },
    });

    return {
      ...defaultContent,
      controller: {
        name: org.name,
        country: org.countryCode ?? jurisdiction,
      },
    };
  });
}

/**
 * Create a new version of a privacy notice for an organization.
 */
export async function createPrivacyNotice(
  organizationId: string,
  jurisdiction: string,
  contentJson: Record<string, unknown>,
): Promise<{ id: string; version: number }> {
  // Get latest version
  const latest = await prisma.privacyNotice.findFirst({
    where: { organizationId, jurisdiction },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const nextVersion = (latest?.version ?? 0) + 1;

  const notice = await prisma.privacyNotice.create({
    data: {
      organizationId,
      jurisdiction,
      version: nextVersion,
      contentJson,
      effectiveFrom: new Date(),
    },
  });

  return { id: notice.id, version: notice.version };
}
