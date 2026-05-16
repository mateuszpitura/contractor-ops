import { createIntegrationLogger } from '@contractor-ops/logger';
import type {
  CompanyLookupRequest,
  CompanyLookupResult,
  CompanyRegistryAdapter,
} from '../types/company-registry.js';

// ---------------------------------------------------------------------------
// Dataport.pl company-registry adapter
// ---------------------------------------------------------------------------
//
// Free tier (10 req/day) works without an API key — dataport authorises by IP.
// A `DATAPORT_API_KEY` is sent as `X-API-Key` only when configured (paid tier).

const log = createIntegrationLogger('dataport');

const DEFAULT_BASE_URL = 'https://dataport.pl';
const DEFAULT_TIMEOUT_MS = 8_000;

export interface DataportAdapterOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

interface DataportCompanyResponse {
  nip?: string;
  regon?: string;
  name?: string;
  legalName?: string;
  status?: string;
  address?: {
    street?: string;
    buildingNumber?: string;
    apartmentNumber?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
}

export class DataportCompanyRegistryAdapter implements CompanyRegistryAdapter {
  readonly providerName = 'Dataport';
  readonly slug = 'dataport' as const;

  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetcher: typeof fetch;

  constructor(options: DataportAdapterOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.DATAPORT_API_KEY;
    this.baseUrl = (options.baseUrl ?? process.env.DATAPORT_BASE_URL ?? DEFAULT_BASE_URL).replace(
      /\/+$/,
      '',
    );
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetcher = options.fetcher ?? fetch;
  }

  async lookupByNip(req: CompanyLookupRequest): Promise<CompanyLookupResult> {
    const url = `${this.baseUrl}/api/v1/company/${encodeURIComponent(req.nip)}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'contractor-ops/dataport-adapter',
    };
    if (this.apiKey) headers['X-API-Key'] = this.apiKey;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetcher(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (response.status === 404) {
        log.debug({ nip: req.nip }, 'dataport: NIP not found');
        return { found: false, rawProvider: this.slug };
      }

      if (!response.ok) {
        const body = await safeReadText(response);
        const err = new Error(
          `Dataport HTTP ${response.status} ${response.statusText}: ${body.slice(0, 200)}`,
        ) as Error & { status: number };
        err.status = response.status;
        throw err;
      }

      const payload = (await response.json()) as DataportCompanyResponse | null | undefined;
      return mapDataportResponse(payload, this.slug);
    } finally {
      clearTimeout(timer);
    }
  }
}

function mapDataportResponse(
  payload: DataportCompanyResponse | null | undefined,
  slug: 'dataport',
): CompanyLookupResult {
  if (!(payload && (payload.name || payload.legalName || payload.regon))) {
    return { found: false, rawProvider: slug };
  }

  const street = payload.address?.street?.trim() ?? '';
  const building = payload.address?.buildingNumber?.trim() ?? '';
  const apartment = payload.address?.apartmentNumber?.trim() ?? '';
  const buildingPart = apartment ? `${building}/${apartment}` : building;
  const addressLine1 = [street, buildingPart].filter(Boolean).join(' ').trim();

  return {
    found: true,
    legalName: payload.legalName ?? payload.name ?? '',
    regon: payload.regon ?? '',
    addressLine1: addressLine1 || undefined,
    city: payload.address?.city?.trim() || undefined,
    postalCode: payload.address?.postalCode?.trim() || undefined,
    countryCode: payload.address?.country?.toUpperCase() || 'PL',
    rawProvider: slug,
  };
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
