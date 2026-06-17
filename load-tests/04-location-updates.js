/**
 * TEST 4 — Driver Location Updates
 * 50 VUs all authenticating as the same test driver (location updates are
 * stateless — multiple devices for one driver is fine for load testing).
 * Token refreshes automatically on 401.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { getOrLogin, authHeaders, refreshIfNeeded } from './auth-helper.js';

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

export default function () {
  let tokenObj = getOrLogin('DRIVER', SECRET);
  if (!tokenObj) return;

  const lat = 11.9462 + (Math.random() - 0.5) * 0.01;
  const lng = 75.4928 + (Math.random() - 0.5) * 0.01;

  const start = Date.now();
  const res = http.post(
    `${BASE}/drivers/location`,
    JSON.stringify({ lat, lng }),
    { headers: authHeaders(tokenObj.accessToken, SECRET) },
  );
  locationDuration.add(Date.now() - start);
  tokenObj = refreshIfNeeded(res, tokenObj, SECRET);

  check(res, { 'location update 200': (r) => r.status === 200 }) || locationErrors.add(1);

  sleep(5);
}
