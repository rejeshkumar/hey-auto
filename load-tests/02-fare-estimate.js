/**
 * TEST 2 — Fare Estimate
 * 100 concurrent VUs, each with their own rider account.
 * Tokens are refreshed automatically on 401.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { getOrLogin, authHeaders, refreshIfNeeded } from './auth-helper.js';

const BASE    = 'https://hey-auto-server-production.up.railway.app/api/v1';
const SECRET  = __ENV.LOAD_TEST_SECRET || '';
const estimateDuration = new Trend('fare_estimate_duration', true);

export const options = {
  stages: [
    { duration: '20s', target: 20  },
    { duration: '60s', target: 100 },
    { duration: '60s', target: 100 },
    { duration: '20s', target: 0   },
  ],
  thresholds: {
    http_req_duration:      ['p(95)<1500', 'p(99)<3000'],
    http_req_failed:        ['rate<0.02'],
    fare_estimate_duration: ['p(95)<1200'],
  },
};

const PICKUPS = [
  { lat: 11.9462, lng: 75.4928 },
  { lat: 11.9480, lng: 75.4940 },
  { lat: 11.9550, lng: 75.4850 },
  { lat: 11.9400, lng: 75.5000 },
];
const DROPOFFS = [
  { lat: 11.9812, lng: 75.3644 },
  { lat: 11.9700, lng: 75.4200 },
  { lat: 12.0000, lng: 75.4500 },
  { lat: 11.9300, lng: 75.5100 },
];

export default function () {
  let tokenObj = getOrLogin('RIDER', SECRET);
  if (!tokenObj) return;

  const pickup  = PICKUPS[__VU % PICKUPS.length];
  const dropoff = DROPOFFS[__VU % DROPOFFS.length];

  const start = Date.now();
  const res = http.post(
    `${BASE}/rides/estimate`,
    JSON.stringify({ pickupLat: pickup.lat, pickupLng: pickup.lng, dropoffLat: dropoff.lat, dropoffLng: dropoff.lng, city: 'taliparamba' }),
    { headers: authHeaders(tokenObj.accessToken, SECRET) },
  );
  estimateDuration.add(Date.now() - start);

  tokenObj = refreshIfNeeded(res, tokenObj, SECRET);

  check(res, {
    'fare estimate 200':      (r) => r.status === 200,
    'fare estimate has total': (r) => { try { return !!JSON.parse(r.body).data.totalFare; } catch { return false; } },
  });

  sleep(1);
}
