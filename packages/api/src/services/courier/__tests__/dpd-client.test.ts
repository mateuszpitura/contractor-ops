import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DPDShipmentParams } from '../courier-client';
import { DPDClient } from '../dpd-client';

// ---------------------------------------------------------------------------
// DPD Client Tests
// ---------------------------------------------------------------------------

const TEST_CONFIG = {
  username: 'test-user',
  password: 'test-pass',
  fid: 'FID123',
  sandbox: true,
};

const DPD_SANDBOX_BASE =
  'https://dpdservicesdemo.dpd.com.pl/DPDPackageObjServicesService/DPDPackageObjServices';
const _DPD_PRODUCTION_BASE =
  'https://dpdservices.dpd.com.pl/DPDPackageObjServicesService/DPDPackageObjServices';

function createClient(overrides?: Partial<typeof TEST_CONFIG>) {
  return new DPDClient({ ...TEST_CONFIG, ...overrides });
}

function mockFetchResponse(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    arrayBuffer: () => Promise.resolve(new TextEncoder().encode('PDF_CONTENT').buffer),
  });
}

describe('DPDClient', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('createShipment', () => {
    it('sends POST to DPD API with correct auth and payload, returns CourierShipmentResult', async () => {
      const mockFetch = mockFetchResponse({
        parcels: [
          {
            id: 12345,
            waybill: '0000123456789',
            status: 'NEW',
          },
        ],
      });
      globalThis.fetch = mockFetch;

      const client = createClient();
      const params: DPDShipmentParams = {
        organizationId: 'org-abc',
        direction: 'OUTBOUND',
        receiver: {
          name: 'Jan Kowalski',
          email: 'jan@example.com',
          phone: '500600700',
        },
        sender: {
          name: 'Firma Sp. z o.o.',
          email: 'office@firma.pl',
          phone: '221234567',
          street: 'ul. Testowa 1',
          city: 'Warszawa',
          postalCode: '00-001',
          countryCode: 'PL',
        },
        deliveryAddress: {
          street: 'ul. Odbiorcza 5',
          city: 'Krakow',
          postalCode: '30-001',
          countryCode: 'PL',
        },
        parcelSize: 'medium',
        reference: 'SHIP-001',
      };

      const result = await client.createShipment(params);

      // Verify fetch was called
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain(DPD_SANDBOX_BASE);

      // Verify method and auth
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');

      // Verify body contains auth credentials and parcel data
      const body = JSON.parse(options.body);
      expect(body.authData.login).toBe('test-user');
      expect(body.authData.password).toBe('test-pass');
      expect(body.authData.masterFid).toBe('FID123');

      // Verify parcel size mapping
      expect(body.parcels[0].sizeX).toBe(40);
      expect(body.parcels[0].sizeY).toBe(30);
      expect(body.parcels[0].sizeZ).toBe(20);
      expect(body.parcels[0].weight).toBe(5);

      // Verify receiver address
      expect(body.parcels[0].receiver.address.street).toBe('ul. Odbiorcza 5');
      expect(body.parcels[0].receiver.address.city).toBe('Krakow');

      // Verify result
      expect(result).toEqual({
        externalId: '12345',
        trackingNumber: '0000123456789',
        status: 'NEW',
      });
    });

    it('throws on non-2xx response', async () => {
      globalThis.fetch = mockFetchResponse({ error: 'Invalid credentials' }, 401);

      const client = createClient();
      const params: DPDShipmentParams = {
        organizationId: 'org-abc',
        direction: 'OUTBOUND',
        receiver: { name: 'Test', email: 't@t.com', phone: '123' },
        sender: {
          name: 'Sender',
          email: 's@s.com',
          phone: '456',
          street: 'St',
          city: 'City',
          postalCode: '00-000',
          countryCode: 'PL',
        },
        deliveryAddress: {
          street: 'St',
          city: 'City',
          postalCode: '00-000',
          countryCode: 'PL',
        },
        parcelSize: 'small',
      };

      await expect(client.createShipment(params)).rejects.toThrow('HTTP 401');
    });
  });

  describe('getStatus', () => {
    it('sends GET to DPD tracking endpoint, returns CourierStatusResult', async () => {
      const mockFetch = mockFetchResponse({
        parcelId: '12345',
        waybill: '0000123456789',
        status: 'DEP_DELIVERED',
        eventTimestamp: '2026-04-04T10:00:00Z',
      });
      globalThis.fetch = mockFetch;

      const client = createClient();
      const result = await client.getStatus('12345');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/tracking');
      expect(options.method).toBe('GET');

      expect(result).toEqual({
        externalId: '12345',
        status: 'DEP_DELIVERED',
        trackingNumber: '0000123456789',
        updatedAt: '2026-04-04T10:00:00Z',
      });
    });
  });

  describe('getLabel', () => {
    it('returns PDF buffer from label endpoint', async () => {
      const mockFetch = mockFetchResponse({}, 200);
      globalThis.fetch = mockFetch;

      const client = createClient();
      const result = await client.getLabel('12345', 'pdf');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/label');
      expect(options.method).toBe('GET');
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('cancelShipment', () => {
    it('sends POST to cancel endpoint', async () => {
      const mockFetch = mockFetchResponse({}, 200);
      globalThis.fetch = mockFetch;

      const client = createClient();
      await client.cancelShipment('12345');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/cancel');
      expect(options.method).toBe('POST');
    });
  });

  describe('sandbox vs production URL', () => {
    it('uses sandbox URL when sandbox=true', async () => {
      const mockFetch = mockFetchResponse({
        parcelId: '1',
        waybill: 'W1',
        status: 'NEW',
      });
      globalThis.fetch = mockFetch;

      const client = createClient({ sandbox: true });
      await client.getStatus('1');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('dpdservicesdemo.dpd.com.pl');
    });

    it('uses production URL when sandbox=false', async () => {
      const mockFetch = mockFetchResponse({
        parcelId: '1',
        waybill: 'W1',
        status: 'NEW',
      });
      globalThis.fetch = mockFetch;

      const client = createClient({ sandbox: false });
      await client.getStatus('1');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('dpdservices.dpd.com.pl');
      expect(url).not.toContain('demo');
    });
  });
});
