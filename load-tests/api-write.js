/**
 * Write-path tRPC load test (POST + superjson body), mimicking httpLink.
 *
 * Mirrors api-read.js auth/env conventions but targets mutations. Default
 * target is `notification.markAllRead` because it is idempotent-ish: it
 * bulk-updates an org's unread rows and never creates new rows, so repeated
 * calls converge rather than explode storage. Do NOT point this at procedures
 * that create rows unless you plan to clean up afterward.
 *
 * Requires SESSION_COOKIE (e.g. better-auth.session_token=...; better-auth.active_organization=...).
 * For RPS above middleware limits, set LOAD_TEST_BYPASS=1 + LOAD_TEST_SECRET on the server and pass
 * the same secret via LOAD_TEST_SECRET in k6 (-e LOAD_TEST_SECRET=...).
 *
 *   BASE_URL=http://localhost:3000 \
 *   SESSION_COOKIE='better-auth.session_token=...' \
 *   k6 run load-tests/api-write.js
 *
 * Stress profile:
 *   k6 run -e K6_PROFILE=stress -e BASE_URL=... -e SESSION_COOKIE=... load-tests/api-write.js
 *
 * Custom procedure (must be a POST/mutation):
 *   PROC_NAME=reassessment-trigger.dismiss \
 *   PROC_INPUT='{"triggerId":"trg_xxx","reason":"test"}' \
 *   k6 run load-tests/api-write.js
 */

import { check, fail } from 'k6';
import http from 'k6/http';

const baseUrl = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const sessionCookie = __ENV.SESSION_COOKIE || '';
const loadTestSecret = __ENV.LOAD_TEST_SECRET || '';

/** Default procedure: notification.markAllRead (zero input, idempotent-ish). */
const DEFAULT_PROC = 'notification.markAllRead';

const procName = __ENV.PROC_NAME || DEFAULT_PROC;

/**
 * Build the superjson-shaped POST body for a tRPC mutation (non-batched httpLink).
 * - No input → { json: null, meta: { values: ['undefined'], v: 1 } }
 * - Input → { json: <input> }
 */
function buildBody() {
  const raw = __ENV.PROC_INPUT;
  if (!raw) {
    return JSON.stringify({ json: null, meta: { values: ['undefined'], v: 1 } });
  }
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify({ json: parsed });
  } catch (err) {
    fail(`PROC_INPUT is not valid JSON: ${err}`);
  }
}

const body = buildBody();

function trpcOk(res) {
  if (res.status !== 200) return false;
  try {
    const j = JSON.parse(res.body);
    if (j?.error) return false;
    if (Array.isArray(j)) return j.every(item => !item?.error);
    return j?.result != null;
  } catch {
    return false;
  }
}

const profile = __ENV.K6_PROFILE || 'default';

export const options =
  profile === 'stress'
    ? {
        stages: [
          { duration: '30s', target: 10 },
          { duration: '90s', target: 25 },
          { duration: '30s', target: 0 },
        ],
        thresholds: {
          http_req_failed: ['rate<0.1'],
          http_req_duration: ['p(95)<8000'],
        },
      }
    : {
        vus: Number(__ENV.K6_VUS || 5),
        duration: __ENV.K6_DURATION || '60s',
        thresholds: {
          http_req_failed: ['rate<0.05'],
          http_req_duration: ['p(95)<5000'],
        },
      };

export function setup() {
  if (!sessionCookie.trim()) {
    fail('Set SESSION_COOKIE to a logged-in Cookie header value (see load-tests/README.md)');
  }
  return { baseUrl, procName };
}

export default function () {
  const headers = {
    cookie: sessionCookie,
    accept: 'application/json',
    'content-type': 'application/json',
  };
  if (loadTestSecret) {
    headers['X-Load-Test-Secret'] = loadTestSecret;
  }

  const res = http.post(`${baseUrl}/api/trpc/${procName}`, body, { headers });
  check(res, {
    [`trpc ${procName} ok`]: trpcOk,
  });
}
