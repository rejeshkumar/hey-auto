/**
 * TEST 4 — Driver Location Updates
 * 50 VUs all authenticating as the same test driver (location updates are
 * stateless — multiple devices for one driver is fine for load testing).
 * Token refreshes automatically on 401.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { login, authHeaders } from './auth-helper.js';

const BASE   = 'https://hey-auto-server-production.up.railway.app/api/v1';
const SECRET = __ENV.LOAD_TEST_SECRET || '';

const locationErrors   = new Counter('location_errors');
const locationDuration = new Trend('location_update_duration', true);

export const options = {
  scenarios: {
    drivers_online: {
      executor: 'constant-vus',
      vus: 50,
      duration: '3m',
    },
  },
  thresholds: {
    http_req_duration:        ['p(95)<500'],
    http_req_failed:          ['rate<0.01'],
    location_update_duration: ['p(99)<800'],
  },
};

// setup() runs once before all VUs — get ONE driver token and share it
export function setup() {
  const tokens = login('8095481555', 'DRIVER', SECRET);
  if (!tokens) throw new Error('Could not get driver token in setup()');
  return { token: tokens.accessToken };
}

export default function (data) {
  if (!data.token) return;

  const lat = 11.9462 + (Math.random() - 0.5) * 0.01;
  const lng = 75.4928 + (Math.random() - 0.5) * 0.01;

  const start = Date.now();
  const res = http.put(
    `${BASE}/drivers/location`,
    JSON.stringify({ lat, lng }),
    { headers: authHeaders(data.token, SECRET) },
  );
  locationDuration.add(Date.now() - start);

  check(res, { 'location update 200': (r) => r.status === 200 }) || locationErrors.add(1);

  sleep(5);
}
