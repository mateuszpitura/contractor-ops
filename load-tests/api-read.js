/**
 * Read-only tRPC load (GET + superjson input), mimicking httpLink in development.
 *
 * Requires SESSION_COOKIE (e.g. better-auth.session_token=...; better-auth.active_organization=...).
 * For RPS above middleware limits, set LOAD_TEST_BYPASS=1 + LOAD_TEST_SECRET on the server and pass
 * the same secret via LOAD_TEST_SECRET in k6 (-e LOAD_TEST_SECRET=...).
 *
 *   BASE_URL=http://localhost:3000 \
 *   SESSION_COOKIE='better-auth.session_token=...' \
 *   k6 run load-tests/api-read.js
 *
 * Stress profile:
 *   k6 run -e K6_PROFILE=stress -e BASE_URL=... -e SESSION_COOKIE=... load-tests/api-read.js
 */

import { check, fail } from "k6";
import http from "k6/http";

const baseUrl = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const sessionCookie = __ENV.SESSION_COOKIE || "";
const loadTestSecret = __ENV.LOAD_TEST_SECRET || "";

/** superjson.serialize(undefined) */
const INPUT_UNDEFINED = encodeURIComponent(
  JSON.stringify({ json: null, meta: { values: ["undefined"], v: 1 } }),
);
/** superjson.serialize({}) */
const INPUT_EMPTY_OBJECT = encodeURIComponent(JSON.stringify({ json: {} }));
/** superjson.serialize({ months: "6" }) */
const INPUT_SPEND = encodeURIComponent(JSON.stringify({ json: { months: "6" } }));

const procedures = [
  { path: `organization.getCurrent?input=${INPUT_UNDEFINED}`, name: "organization.getCurrent" },
  { path: `dashboard.kpis?input=${INPUT_UNDEFINED}`, name: "dashboard.kpis" },
  { path: `dashboard.deadlines?input=${INPUT_UNDEFINED}`, name: "dashboard.deadlines" },
  { path: `dashboard.activity?input=${INPUT_UNDEFINED}`, name: "dashboard.activity" },
  { path: `dashboard.spendTrend?input=${INPUT_SPEND}`, name: "dashboard.spendTrend" },
  { path: `contractor.list?input=${INPUT_EMPTY_OBJECT}`, name: "contractor.list" },
  { path: `invoice.list?input=${INPUT_EMPTY_OBJECT}`, name: "invoice.list" },
];

function trpcOk(res) {
  if (res.status !== 200) return false;
  try {
    const j = JSON.parse(res.body);
    if (j?.error) return false;
    if (Array.isArray(j)) return j.every((item) => !item?.error);
    return j?.result != null;
  } catch {
    return false;
  }
}

const profile = __ENV.K6_PROFILE || "default";

export const options =
  profile === "stress"
    ? {
        stages: [
          { duration: "30s", target: 15 },
          { duration: "90s", target: 40 },
          { duration: "30s", target: 0 },
        ],
        thresholds: {
          http_req_failed: ["rate<0.1"],
          http_req_duration: ["p(95)<8000"],
        },
      }
    : {
        vus: Number(__ENV.K6_VUS || 8),
        duration: __ENV.K6_DURATION || "60s",
        thresholds: {
          http_req_failed: ["rate<0.05"],
          http_req_duration: ["p(95)<5000"],
        },
      };

export function setup() {
  if (!sessionCookie.trim()) {
    fail("Set SESSION_COOKIE to a logged-in Cookie header value (see load-tests/README.md)");
  }
  return { baseUrl };
}

export default function () {
  const proc = procedures[Math.floor(Math.random() * procedures.length)];
  const headers = {
    cookie: sessionCookie,
    accept: "application/json",
  };
  if (loadTestSecret) {
    headers["X-Load-Test-Secret"] = loadTestSecret;
  }

  const res = http.get(`${baseUrl}/api/trpc/${proc.path}`, { headers });
  check(res, {
    [`trpc ${proc.name} ok`]: trpcOk,
  });
}
