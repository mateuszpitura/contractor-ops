#!/usr/bin/env node

/**
 * Przykład flow KSeF API 2.x (środowisko TEST, OpenAPI v2.3).
 *
 * Dokumentacja: https://api-test.ksef.mf.gov.pl/docs/v2/index.html
 * OpenAPI `servers.url`: https://api-test.ksef.mf.gov.pl/v2
 *
 * Uruchomienie (repo-root `.env` przez dotenv):
 *   node scripts/ksef-te-flow.mjs
 *
 * Zmienne: KSEF_TOKEN, KSEF_NIP; opcjonalnie KSEF_BASE_URL, KSEF_DATE_FROM, KSEF_DATE_TO
 * Token KSeF musi pochodzić z **tego samego środowiska** co BASE_URL (dla TEST — portal/test, nie produkcja).
 *
 * ## Integracja w aplikacji (SaaS / wielu klientów)
 * Każdy klient powinien w Twojej aplikacji podać **własny** token KSeF oraz **własny** NIP kontekstu
 * (`contextIdentifier` przy uwierzytelnianiu). To ten sam NIP co podmiot, w którego imieniu token ma
 * uprawnienia w KSeF — zwykle firma, która odbiera faktury. **Nie** da się jednym „Twoim” tokenem
 * i swoim NIPem pobierać faktur dowolnej innej firmy bez formalnego upoważnienia w KSeF; wtedy
 * obowiązują inne ścieżki (np. `SubjectAuthorized` po stronie MF).
 *
 * ## POST /invoices/query/metadata — zakres dat (OpenAPI)
 * Maksymalny dozwolony okres filtrowania to **3 miesiące** (w interpretacji UTC lub Europe/Warsaw).
 * Daty w `dateRange.from` / `dateRange.to` w formacie **ISO 8601**, np. `yyyy-MM-ddTHH:mm:ss`.
 * Dozwolone warianty czasu:
 * - z sufiksem `Z` (UTC),
 * - z jawnym offsetem, np. `+01:00`,
 * - **bez offsetu** — interpretowane jako czas lokalny **Europe/Warsaw** (tak budujemy `from`/`to` poniżej).
 * Dłuższą historię trzeba pobrać **kilkoma zapytaniami** (oknami po max. 3 mies.).
 *
 * Szczegółowe logi HTTP (request/response, z redakcją wrażliwych pól):
 *   KSEF_DEBUG=1 node scripts/ksef-te-flow.mjs
 * Opcjonalnie max długość zapisanego body odpowiedzi: KSEF_LOG_MAX=12000
 */

import { constants, publicEncrypt, X509Certificate } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({ path: path.join(repoRoot, '.env'), quiet: true });

// Zgodnie z OpenAPI — host + `/v2` (nie mylić z aliasem `/api/v2`).
const BASE_URL =
  process.env.KSEF_BASE_URL?.replace(/\/$/, '') ?? 'https://api-test.ksef.mf.gov.pl/v2';
const TOKEN = process.env.KSEF_TOKEN ?? '';
const NIP = (process.env.KSEF_NIP ?? '').replace(/\D/g, '');
const DATE_FROM = process.env.KSEF_DATE_FROM ?? '2025-01-01';
const DATE_TO = process.env.KSEF_DATE_TO ?? '2026-12-31';

const DEBUG = process.env.KSEF_DEBUG === '1' || /^(true|yes)$/i.test(process.env.KSEF_DEBUG ?? '');
const LOG_MAX = Math.min(Math.max(Number(process.env.KSEF_LOG_MAX) || 12000, 500), 500_000);

/** Parsowanie `YYYY-MM-DD` (tylko zapytanie o faktury — nie pełny ISO z czasem). */
function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
  if (!m) {
    throw new Error(`Oczekiwano daty YYYY-MM-DD, otrzymano: ${s}`);
  }
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
}

function ymdFromUtcDate(d) {
  return d.toISOString().slice(0, 10);
}

/** Ostatni dzień miesiąca (m = 1..12) w roku `y` (UTC). */
function lastDayOfMonthUtc(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function ymdFromParts(y, mo, d) {
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** `fromYmd` + N miesięcy kalendarzowych; dzień jest przycinany, jeśli docelowy miesiąc jest krótszy (np. 31 sty → 28/29 lut). */
function addCalendarMonthsYmd(fromYmd, monthDelta) {
  const { y, mo, d } = parseYmd(fromYmd);
  const idx = mo - 1 + monthDelta;
  const ty = y + Math.floor(idx / 12);
  const tm0 = ((idx % 12) + 12) % 12;
  const tmo = tm0 + 1;
  const maxD = lastDayOfMonthUtc(ty, tmo);
  const td = Math.min(d, maxD);
  return ymdFromParts(ty, tmo, td);
}

function compareYmd(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Ostatnia dozwolona data końca (włącznie) dla API: okres od `from` nie dłuższy niż 3 mies. kalendarzowe. */
function maxInclusiveToYmdForThreeMonthApiWindow(fromYmd) {
  const endExclusive = addCalendarMonthsYmd(fromYmd, 3);
  const { y, mo, d } = parseYmd(endExclusive);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return ymdFromUtcDate(dt);
}

/**
 * Zwraca `{ fromYmd, toYmd }` mieściące się w limicie 3 mies. od `fromYmd`.
 * Przy przycięciu wypisuje ostrzeżenie (pełny zakres = kolejne okna zapytań).
 */
function clampInvoiceQueryYmdRange(fromYmd, toYmd) {
  if (compareYmd(fromYmd, toYmd) > 0) {
    throw new Error(
      `KSEF_DATE_FROM (${fromYmd}) nie może być późniejsze niż KSEF_DATE_TO (${toYmd})`,
    );
  }
  const maxTo = maxInclusiveToYmdForThreeMonthApiWindow(fromYmd);
  if (compareYmd(toYmd, maxTo) <= 0) {
    return { fromYmd, toYmd, clamped: false };
  }
  console.warn(
    `[ksef] Zakres dat przycięty do limitu API (max. 3 mies. od ${fromYmd}): ` +
      `było do ${toYmd}, zapytanie użyje do ${maxTo}. ` +
      `Pełną historię pobierz kolejnymi zapytaniami (następne okno od następnego dnia po ${maxTo}).`,
  );
  return { fromYmd, toYmd: maxTo, clamped: true };
}

function sanitizeHeadersForLog(headers) {
  const h = { ...headers };
  if (h.Authorization) {
    const raw = h.Authorization.replace(/^Bearer\s+/i, '');
    h.Authorization = `Bearer <redacted len=${raw.length} …${raw.slice(-6)}>`;
  }
  return h;
}

/** Redakcja JSON-ów do logów (tokeny, JWT, PEM/base64 certyfikatów). */
function sanitizeForLog(data, depth = 0) {
  if (depth > 14) return data;
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') {
    if (data.split('.').length === 3 && data.length > 40) {
      return `<jwt len=${data.length} …${data.slice(-8)}>`;
    }
    if (data.length > 120 && /^[A-Za-z0-9+/=\s\n]+$/s.test(data)) {
      return `<base64-like len=${data.length}>`;
    }
    return data.length > LOG_MAX ? `${data.slice(0, LOG_MAX)}…` : data;
  }
  if (Array.isArray(data)) {
    return data.map(x => sanitizeForLog(x, depth + 1));
  }
  if (typeof data === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(data)) {
      if (k === 'encryptedToken' && typeof v === 'string') {
        o[k] = `<base64 ${v.length} chars>`;
        continue;
      }
      if (k === 'certificate' && typeof v === 'string' && v.length > 80) {
        o[k] = `<DER base64 ${v.length} chars>`;
        continue;
      }
      if (k === 'token' && typeof v === 'string' && v.length > 24) {
        o[k] = `<secret len=${v.length} …${v.slice(-6)}>`;
        continue;
      }
      o[k] = sanitizeForLog(v, depth + 1);
    }
    return o;
  }
  return data;
}

function formatBodyForLog(text, contentType) {
  const ct = contentType ?? '';
  if (!text) return '(empty)';
  if (ct.includes('json')) {
    try {
      const j = JSON.parse(text);
      const s = JSON.stringify(sanitizeForLog(j), null, 2);
      return s.length > LOG_MAX ? `${s.slice(0, LOG_MAX)}\n… [truncated]` : s;
    } catch {
      return text.length > LOG_MAX ? `${text.slice(0, LOG_MAX)}…` : text;
    }
  }
  return text.length > LOG_MAX ? `${text.slice(0, LOG_MAX)}…` : text;
}

/**
 * Fetch z opcjonalnym logiem: metoda, URL, nagłówki (bez pełnego Bearer), body żądania / odpowiedzi.
 */
async function loggedFetch(url, options = {}) {
  const method = options.method ?? 'GET';
  const headers = {
    ...(options.headers ?? {}),
  };

  if (DEBUG) {
    console.error('\n────────── REQUEST ──────────');
    console.error(`${method} ${url}`);
    console.error('headers:', JSON.stringify(sanitizeHeadersForLog(headers), null, 2));
    if (options.body != null && options.body !== '') {
      const raw = String(options.body);
      let printed = raw;
      if (raw.trim().startsWith('{')) {
        try {
          printed = JSON.stringify(sanitizeForLog(JSON.parse(raw)), null, 2);
        } catch {
          printed = raw.length > LOG_MAX ? `${raw.slice(0, LOG_MAX)}…` : raw;
        }
      }
      console.error('body:\n', printed);
    }
  }

  const res = await fetch(url, { ...options, method, headers });
  const text = await res.text();
  const ct = res.headers.get('content-type') ?? '';

  if (DEBUG) {
    console.error('────────── RESPONSE ──────────');
    console.error(`${res.status} ${res.statusText} ← ${method} ${url}`);
    console.error('content-type:', ct || '(none)');
    const interesting = ['x-request-id', 'retry-after', 'www-authenticate'];
    for (const name of interesting) {
      const v = res.headers.get(name);
      if (v) console.error(`${name}:`, v);
    }
    console.error('body:\n', formatBodyForLog(text, ct));
  }

  return { res, text };
}

async function fetchJson(url, options = {}) {
  const { res, text } = await loggedFetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers ?? {}),
    },
  });
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const detail = typeof body === 'object' && body !== null ? JSON.stringify(body) : String(body);
    throw new Error(`HTTP ${res.status} ${url}: ${detail}`);
  }
  return body;
}

/**
 * Odpowiedź `GET /security/public-key-certificates` to zwykle **2 obiekty** (oba w Base64 DER w polu `certificate`):
 *
 * - **KsefTokenEncryption** — RSA: szyfrowanie łańcucha `{tokenKSeF}|{timestampMs}` przed `POST /auth/ksef-token`.
 * - **SymmetricKeyEncryption** — RSA: opakowanie kluczy symetrycznych (np. przy pobieraniu treści zaszyfrowanych
 *   algorytmem symetrycznym). Ten skrypt używa wyłącznie pierwszego wariantu.
 *
 * @see https://github.com/CIRFMF/ksef-docs/blob/main/uwierzytelnianie.md (token KSeF, RSA-OAEP)
 */
async function fetchKsefTokenEncryptionPublicKey() {
  const rows = await fetchJson(`${BASE_URL}/security/public-key-certificates`, {
    method: 'GET',
  });
  if (!Array.isArray(rows)) {
    throw new Error('Oczekiwano tablicy z /security/public-key-certificates');
  }
  const row = rows.find(r => Array.isArray(r.usage) && r.usage.includes('KsefTokenEncryption'));
  if (!row?.certificate) {
    throw new Error('Brak wpisu z usage KsefTokenEncryption');
  }
  const der = Buffer.from(row.certificate, 'base64');
  return new X509Certificate(der).publicKey;
}

function formatAuthStatusError(st) {
  const s = st?.status;
  if (!s) return JSON.stringify(st);
  const parts = [`[${s.code}] ${s.description ?? ''}`.trim()];
  if (Array.isArray(s.details) && s.details.length) {
    parts.push(...s.details);
  }
  return parts.join('\n');
}

/**
 * 1) GET /security/public-key-certificates → RSA (KsefTokenEncryption)
 * 2) POST /auth/challenge
 * 3) RSA-OAEP SHA-256: `{token}|{timestampMs}` → Base64
 * 4) POST /auth/ksef-token → referenceNumber + authenticationToken
 * 5) GET /auth/{referenceNumber} (Bearer authenticationToken) aż status.code === 200
 * 6) POST /auth/token/redeem (Bearer authenticationToken) → accessToken + refreshToken
 */
async function authenticate(token, nip) {
  const rsaKey = await fetchKsefTokenEncryptionPublicKey();

  const challengePayload = await fetchJson(`${BASE_URL}/auth/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });

  const { challenge, timestampMs } = challengePayload;
  const plaintext = Buffer.from(`${token}|${timestampMs}`);
  const encrypted = publicEncrypt(
    {
      key: rsaKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    plaintext,
  );

  const init = await fetchJson(`${BASE_URL}/auth/ksef-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challenge,
      // OpenAPI: AuthenticationContextIdentifierType — wartości case-sensitive (np. "Nip", nie "nip").
      contextIdentifier: { type: 'Nip', value: nip },
      encryptedToken: encrypted.toString('base64'),
    }),
  });

  const referenceNumber = init.referenceNumber;
  const authToken = init.authenticationToken?.token;
  if (!(referenceNumber && authToken)) {
    throw new Error('Brak referenceNumber lub authenticationToken w odpowiedzi ksef-token');
  }

  let authReady = false;
  for (let i = 0; i < 60; i++) {
    const st = await fetchJson(`${BASE_URL}/auth/${encodeURIComponent(referenceNumber)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });
    const code = st?.status?.code;
    if (code === 200) {
      authReady = true;
      break;
    }
    if (code !== undefined && code !== 100) {
      const hint =
        code === 450
          ? '\n\n→ Kod 450: KSeF nie rozpoznaje tokena. Najczęściej: token wygenerowany w **innym środowisku** (np. produkcja zamiast TEST), unieważniony token, literówka w wartości, albo NIP kontekstu nie zgadza się z tokenem. Wygeneruj nowy token KSeF w **portalu środowiska TEST** (ten sam co api-test.ksef.mf.gov.pl) i ustaw KSEF_NIP zgodny z uprawnieniami tego tokena.'
          : '';
      throw new Error(`Uwierzytelnianie KSeF nieudane:\n${formatAuthStatusError(st)}${hint}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  if (!authReady) {
    throw new Error('Timeout: status uwierzytelniania nie osiągnął kodu 200');
  }

  const tokens = await fetchJson(`${BASE_URL}/auth/token/redeem`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: '{}',
  });

  const accessToken = tokens?.accessToken?.token;
  const refreshToken = tokens?.refreshToken?.token;
  if (!accessToken) {
    throw new Error('Brak accessToken po /auth/token/redeem');
  }

  return { accessToken, refreshToken, referenceNumber };
}

/**
 * Lista metadanych faktur — POST /invoices/query/metadata (odpowiedź 200, paginacja query).
 *
 * `Subject2` = perspektywa **nabywcy**; nabywcą jest podmiot z **kontekstu tokenu** (NIP z logowania).
 * API wymaga wtedy **`buyerIdentifier` = null** (walidacja: „'buyer' must be null when 'subject' is 'Subject2'”).
 * Filtrowanie po innym NIP nabywcy dotyczy innych wartości `subjectType` — patrz OpenAPI.
 *
 * Limity `dateRange`: max. **3 miesiące** (UTC lub WAW); format ISO 8601 — tu `from`/`to` **bez offsetu**
 * (interpretacja jako Europe/Warsaw wg OpenAPI). Zob. nagłówek pliku.
 */
async function queryInvoiceMetadata(accessToken, dateFrom, dateTo) {
  const { fromYmd, toYmd } = clampInvoiceQueryYmdRange(
    String(dateFrom).trim(),
    String(dateTo).trim(),
  );
  const from = `${fromYmd}T00:00:00`;
  const to = `${toYmd}T23:59:59`;

  const url = new URL(`${BASE_URL}/invoices/query/metadata`);
  url.searchParams.set('pageOffset', '0');
  url.searchParams.set('pageSize', '50');

  return await fetchJson(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      subjectType: 'Subject2',
      dateRange: {
        dateType: 'Issue',
        from,
        to,
      },
      buyerIdentifier: null,
    }),
  });
}

/** Pobranie XML faktury po numerze KSeF (OpenAPI: application/xml). */
async function downloadInvoiceXml(accessToken, ksefNumber) {
  const url = `${BASE_URL}/invoices/ksef/${encodeURIComponent(ksefNumber)}`;
  const { res, text } = await loggedFetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/xml, text/xml;q=0.9, */*;q=0.8',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} download: ${text}`);
  }
  return text;
}

async function revokeCurrentSession(accessToken) {
  const { res, text } = await loggedFetch(`${BASE_URL}/auth/sessions/current`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 204) {
    console.warn('DELETE /auth/sessions/current:', res.status, text);
  }
}

async function main() {
  if (!TOKEN || NIP.length !== 10) {
    console.error('Ustaw KSEF_TOKEN oraz KSEF_NIP (10 cyfr) w .env lub w środowisku.');
    process.exit(1);
  }
  if (DEBUG) {
    console.error('KSeF_DEBUG=1 — pełne logi HTTP na stderr (tokeny/JWT redagowane).');
  }

  let accessToken;
  try {
    const session = await authenticate(TOKEN, NIP);
    accessToken = session.accessToken;

    const meta = await queryInvoiceMetadata(accessToken, DATE_FROM, DATE_TO);
    const list = meta.invoices ?? [];

    const firstKsef = list[0]?.ksefNumber;
    if (firstKsef) {
      const _xml = await downloadInvoiceXml(accessToken, firstKsef);
    }
  } finally {
    if (accessToken) await revokeCurrentSession(accessToken);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
