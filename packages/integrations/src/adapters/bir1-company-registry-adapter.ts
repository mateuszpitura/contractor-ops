import { createIntegrationLogger } from '@contractor-ops/logger';
import type {
  CompanyLookupRequest,
  CompanyLookupResult,
  CompanyRegistryAdapter,
} from '../types/company-registry.js';

// ---------------------------------------------------------------------------
// GUS BIR1 company-registry adapter
// ---------------------------------------------------------------------------
//
// Wraps the `bir1` npm package, which speaks SOAP to the Polish GUS BIR1
// service (https://api.stat.gov.pl/Home/RegonApi). Loaded via dynamic import
// so the SOAP client stays out of cold-start (F-SCALE-14 convention).

const log = createIntegrationLogger('bir1');

interface Bir1Entity {
  Nazwa?: string;
  Regon?: string;
  Ulica?: string;
  NrNieruchomosci?: string;
  NrLokalu?: string;
  Miejscowosc?: string;
  KodPocztowy?: string;
}

interface Bir1Client {
  login(): Promise<unknown>;
  logout(): Promise<unknown>;
  search(args: { nip: string }): Promise<Bir1Entity | Bir1Entity[] | null | undefined>;
}

interface Bir1Module {
  default: new () => Bir1Client;
}

export interface Bir1AdapterOptions {
  /** Inject a factory in tests to avoid importing the real `bir1` package. */
  clientFactory?: () => Promise<Bir1Client>;
}

export class Bir1CompanyRegistryAdapter implements CompanyRegistryAdapter {
  readonly providerName = 'GUS BIR1';
  readonly slug = 'bir1' as const;

  private readonly clientFactory: () => Promise<Bir1Client>;

  constructor(options: Bir1AdapterOptions = {}) {
    this.clientFactory =
      options.clientFactory ??
      (async () => {
        const mod = (await import('bir1')) as unknown as Bir1Module;
        const Bir = mod.default;
        return new Bir();
      });
  }

  async lookupByNip(req: CompanyLookupRequest): Promise<CompanyLookupResult> {
    const client = await this.clientFactory();

    try {
      await client.login();
      const result = await client.search({ nip: req.nip });

      if (!result) {
        log.debug({ nip: req.nip }, 'bir1: NIP not found');
        return { found: false, rawProvider: this.slug };
      }

      const entity = Array.isArray(result) ? result[0] : result;
      if (!entity) return { found: false, rawProvider: this.slug };

      return mapBir1Entity(entity, this.slug);
    } finally {
      await client.logout().catch(err => {
        log.warn({ err }, 'bir1: logout failed (ignored)');
      });
    }
  }
}

function mapBir1Entity(entity: Bir1Entity, slug: 'bir1'): CompanyLookupResult {
  const street = entity.Ulica?.trim() ?? '';
  const building = entity.NrNieruchomosci?.trim() ?? '';
  const apartment = entity.NrLokalu?.trim() ?? '';
  const buildingPart = apartment ? `${building}/${apartment}` : building;
  const addressLine1 = [street, buildingPart].filter(Boolean).join(' ').trim();

  return {
    found: true,
    legalName: entity.Nazwa?.trim() || '',
    regon: entity.Regon?.trim() || '',
    addressLine1: addressLine1 || undefined,
    city: entity.Miejscowosc?.trim() || undefined,
    postalCode: entity.KodPocztowy?.trim() || undefined,
    countryCode: 'PL',
    rawProvider: slug,
  };
}
