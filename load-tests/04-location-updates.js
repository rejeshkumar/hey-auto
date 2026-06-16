/**
 * TEST 4 — Driver Location Updates
 * Simulates N drivers online, each pinging location every 5 seconds.
 * This is the constant background load — 50 drivers = 10 pings/sec forever.
 * Run with: k6 run -e AUTH_TOKEN=xxx 04-location-updates.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE = 'https://hey-auto-server-production.up.railway.app/api/v1';
const LOAD_TEST_SECRET = __ENV.LOAD_TEST_SECRET || '';
const locationErrors   = new Counter('location_errors');
const locationDuration = new Trend('location_update_duration', true);

export const options = {
  // Simulate 50 drivers online simultaneously, each pinging every 5s
  scenarios: {
    drivers_online: {
      executor: 'constant-vus',
      vus: 50,
      duration: '3m',
    },
  },
  thresholds: {
    http_req_duration:       ['p(95)<500'],   // location update must be fast
    http_req_failed:         ['rate<0.01'],   // max 1% error
    location_update_duration:['p(99)<800'],
  },
};

export function setup() {
  const headers = { 'Content-Type': 'application/json' };
  const phone = '8095481555'; // known test driver
  http.post(`${BASE}/auth/send-otp`, JSON.stringify({ phone, role: 'DRIVER' }), { headers });
  const res = http.post(`${BASE}/auth/verify-otp`,
    JSON.stringify({ phone, otp: '123456', role: 'DRIVER', deviceId: 'location-test' }),
    { headers });
  try {
    return { token: JSON.parse(res.body).data.tokens.accessToken };
  } catch {
    return { token: __ENV.AUTH_TOKEN || '' };
  }
}

export default function (data) {
  const token = data.token || __ENV.AUTH_TOKEN;
  if (!token) return;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(LOAD_TEST_SECRET ? { 'X-Load-Test': LOAD_TEST_SECRET } : {}),
  };

  // Slightly randomise location to simulate movement
  const lat = 11.9462 + (Math.random() - 0.5) * 0.01;
  const lng = 75.4928 + (Math.random() - 0.5) * 0.01;

  const start = Date.now();
  const res = http.post(`${BASE}/drivers/location`,
    JSON.stringify({ lat, lng }), { headers });
  locationDuration.add(Date.now() - start);

  check(res, {
    'location update 200': (r) => r.status === 200,
  }) || locationErrors.add(1);

  sleep(5); // drivers ping every 5 seconds
}
