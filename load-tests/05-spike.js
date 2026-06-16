/**
 * TEST 5 — Spike Test
 * Simulates a sudden spike — e.g. an auto stand with 30 people all
 * trying to book at 8am simultaneously.
 * This is the worst-case scenario for a small town launch.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE = 'https://hey-auto-server-production.up.railway.app/api/v1';
const LOAD_TEST_SECRET = __ENV.LOAD_TEST_SECRET || '';
const errors = new Counter('spike_errors');

export const options = {
  stages: [
    { duration: '10s', target: 1  },   // baseline
    { duration: '5s',  target: 50 },   // SPIKE — 50 users in 5 seconds
    { duration: '30s', target: 50 },   // hold spike
    { duration: '10s', target: 1  },   // recover
    { duration: '30s', target: 1  },   // verify recovery
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'],  // allow up to 5s during spike
    http_req_failed:   ['rate<0.10'],   // allow up to 10% errors during spike
  },
};

export default function () {
  const phone = `91111${String(__VU).padStart(5, '0')}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(LOAD_TEST_SECRET ? { 'X-Load-Test': LOAD_TEST_SECRET } : {}),
  };

  // Just hit the auth endpoint — most common spike pattern
  const res = http.post(`${BASE}/auth/send-otp`,
    JSON.stringify({ phone, role: 'RIDER' }), { headers });

  check(res, {
    'spike otp 200 or 429': (r) => r.status === 200 || r.status === 429,
  }) || errors.add(1);

  sleep(1);
}
