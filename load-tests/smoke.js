/**
 * Quick sanity: GET /api/health (DB ping). No auth or load-test bypass required.
 *
 *   k6 run load-tests/smoke.js
 *   BASE_URL=https://staging.example.com k6 run load-tests/smoke.js
 */

import { check } from 'k6';
import http from 'k6/http';

const baseUrl = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

export const options = {
  vus: Number(__ENV.K6_VUS || 3),
  duration: __ENV.K6_DURATION || '20s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<3000'],
  },
};

export default function () {
  const res = http.get(`${baseUrl}/api/health`);
  check(res, {
    'status 200': r => r.status === 200,
    'body ok': r => {
      try {
        const j = JSON.parse(r.body);
        return j.status === 'ok';
      } catch {
        return false;
      }
    },
  });
}
