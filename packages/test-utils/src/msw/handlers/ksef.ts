import { HttpResponse, http } from "msw";
import type { HandlerOptions } from "../types.js";
import { applyNetworkConditions, mockId } from "../utils.js";

const KSEF_TEST = "https://ksef-test.mf.gov.pl/api/v2";
const KSEF_PROD = "https://ksef.mf.gov.pl/api/v2";

function ksefEndpoints(baseUrl: string, net: HandlerOptions["network"]) {
  return [
    // --- Get Public Key ---
    http.get(`${baseUrl}/auth/public-key`, async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      // Return a dummy RSA public key (PEM format)
      return HttpResponse.json({
        publicKey:
          "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Z3VS5JJcds3xfn/ygWe\nFsWlRNiDteIOPBWfR+oWpwAB8UHAgwBnz5dFz1VbMjCyQjLn1SZ+7+YhJfMPPB+\nVBOlq3GxB3mbBjYpK6Q1szDQ+IhLZoSjR/qB1A0+test+mock+key+AQAB\n-----END PUBLIC KEY-----",
      });
    }),

    // --- Auth Challenge ---
    http.post(`${baseUrl}/auth/challenge`, async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        challenge: `mock-challenge-${mockId().slice(0, 8)}`,
        timestampMs: Date.now(),
      });
    }),

    // --- Redeem Token (Init Session) ---
    http.post(`${baseUrl}/auth/token/redeem`, async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        jwt: `ksef_jwt_${mockId()}`,
        referenceNumber: `ref-${mockId().slice(0, 8)}`,
        encryptionKey: Buffer.alloc(32).toString("base64"),
      });
    }),

    // --- Poll Session Status ---
    http.get(`${baseUrl}/auth/:referenceNumber`, async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        status: "READY",
        processingCode: 200,
      });
    }),

    // --- Start Invoice Query ---
    http.post(`${baseUrl}/invoices/query/metadata`, async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        queryId: `query-${mockId().slice(0, 8)}`,
      });
    }),

    // --- Poll Query Status ---
    http.get(`${baseUrl}/invoices/query/:queryId/status`, async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        status: "COMPLETED",
        processingCode: 200,
        invoiceMetadataList: [
          {
            ksefReferenceNumber: `KSeF-${mockId().slice(0, 10)}`,
            invoiceNumber: "FV/2026/001",
            subjectNip: "1234567890",
            invoiceDate: "2026-03-15",
          },
        ],
        hasMore: false,
      });
    }),

    // --- Download Invoice XML ---
    http.get(`${baseUrl}/invoices/ksef/:ksefReferenceNumber`, async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return new HttpResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns="http://crd.gov.pl/wzor/2023/06/29/12648/">
  <Naglowek>
    <KodFormularza kodSystemowy="FA (2)" wersjaSchemy="1-0E">FA</KodFormularza>
    <DataWytworzeniaFa>2026-03-15T10:00:00</DataWytworzeniaFa>
  </Naglowek>
  <Fa>
    <P_1>2026-03-15</P_1>
    <P_2>FV/2026/001</P_2>
    <P_15>10000.00</P_15>
  </Fa>
</Faktura>`,
        { headers: { "Content-Type": "application/xml" } },
      );
    }),

    // --- Terminate Session ---
    http.post(`${baseUrl}/auth/session/terminate`, async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        timestamp: new Date().toISOString(),
        processingCode: 200,
      });
    }),
  ];
}

export function ksefHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    // Register handlers for both test and production environments
    ...ksefEndpoints(KSEF_TEST, net),
    ...ksefEndpoints(KSEF_PROD, net),
  ];
}
