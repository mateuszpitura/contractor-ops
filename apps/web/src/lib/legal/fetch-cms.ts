import 'server-only';

export type LegalDocType = 'privacy' | 'terms' | 'sub-processors' | 'breach-notification';
export type LegalJurisdiction = 'gb' | 'de' | 'eu' | 'ae' | 'sa';

export type LegalDocument = {
  id: string;
  type: LegalDocType;
  jurisdiction: LegalJurisdiction;
  title: string;
  version: string;
  effectiveDate: string;
  body: unknown;
  updatedAt: string;
};

const ALLOWED_LOCALES = new Set(['en', 'pl', 'de', 'ar']);

function defaultCmsUrl(): string {
  return process.env.CMS_PUBLIC_URL ?? 'http://localhost:3002';
}

export async function fetchLegalDocument(args: {
  type: LegalDocType;
  jurisdiction: LegalJurisdiction;
  locale: string;
}): Promise<LegalDocument | null> {
  const locale = ALLOWED_LOCALES.has(args.locale) ? args.locale : 'en';
  const params = new URLSearchParams();
  params.set('where[type][equals]', args.type);
  params.set('where[jurisdiction][equals]', args.jurisdiction);
  params.set('locale', locale);
  params.set('limit', '1');
  params.set('depth', '0');
  params.set('fallback-locale', 'en');

  const url = `${defaultCmsUrl().replace(/\/$/, '')}/api/legal-documents?${params.toString()}`;
  const tag = `legal:${args.type}:${args.jurisdiction}`;

  let response: Response;
  try {
    response = await fetch(url, {
      next: { tags: [tag], revalidate: 60 },
    });
  } catch {
    return null;
  }
  if (!response.ok) {
    return null;
  }
  const json = (await response.json()) as { docs?: unknown[] };
  const first = json.docs?.[0];
  if (!first || typeof first !== 'object') {
    return null;
  }
  return first as LegalDocument;
}
