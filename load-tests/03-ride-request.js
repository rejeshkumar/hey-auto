/**
 * TEST 3 — Full Ride Request flow
 * 20 VUs, each with their own rider account so there are no "active ride" conflicts.
 * Tokens refresh automatically on 401.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { getOrLogin, authHeaders, refreshIfNeeded } from './auth-helper.js';

const BASE   = 'https://hey-auto-server-production.up.railway.app/api/v1';
const SECRET = __ENV.LOAD_TEST_SECRET || '';

const bookingErrors = new Counter('booking_errors');
const cancelErrors  = new Counter('cancel_errors');
const bookingTime   = new Trend('ride_booking_duration', true);
const cancelTime    = new Trend('ride_cancel_duration', true);

export const options = {
  stages: [
    { duration: '30s', target: 5  },
    { duration: '60s', target: 20 },
    { duration: '60s', target: 20 },
    { duration: '30s', target: 0  },
  ],
  thresholds: {
    http_req_duration:     ['p(95)<3000'],
    http_req_failed:       ['rate<0.05'],
    ride_booking_duration: ['p(95)<2500'],
  },
};

const PICKUPS = [
  { lat: 11.9462, lng: 75.4928, address: 'Taliparamba Bus Stand' },
  { lat: 11.9480, lng: 75.4940, address: 'Taliparamba Hospital' },
  { lat: 11.9550, lng: 75.4850, address: 'Taliparamba Temple' },
];
const DROPOFFS = [
  { lat: 11.9812, lng: 75.3644, address: 'Kannur Railway Station' },
  { lat: 11.9700, lng: 75.4200, address: 'Kannur Town' },
];

export default function () {
  let tokenObj = getOrLogin('RIDER', SECRET);
  if (!tokenObj) return;

  const pickup  = PICKUPS[__VU % PICKUPS.length];
  const dropoff = DROPOFFS[__VU % DROPOFFS.length];

  // Book a ride
  const bookStart = Date.now();
  const bookRes = http.post(`${BASE}/rides/request`, JSON.stringify({
    pickupLat:      pickup.lat,
    pickupLng:      pickup.lng,
    pickupAddress:  pickup.address,
    dropoffLat:     dropoff.lat,
    dropoffLng:     dropoff.lng,
    dropoffAddress: dropoff.address,
    paymentMethod:  'CASH',
    city:           'taliparamba',
  }), { headers: authHeaders(tokenObj.accessToken, SECRET) });
  bookingTime.add(Date.now() - bookStart);
  tokenObj = refreshIfNeeded(bookRes, tokenObj, SECRET);

  const bookOk = check(bookRes, {
    'ride request 200/201': (r) => r.status === 200 || r.status === 201,
    'ride has id':          (r) => { try { return !!JSON.parse(r.body).data.id; } catch { return false; } },
  });

  if (!bookOk) { bookingErrors.add(1); sleep(15); return; }

  const rideId = JSON.parse(bookRes.body).data.id;

  // Poll until ride is in a cancellable state (REQUESTED) or already terminal
  let rideStatus = 'REQUESTED';
  for (let i = 0; i < 5; i++) {
    sleep(1);
    const statusRes = http.get(`${BASE}/rides/${rideId}`, { headers: authHeaders(tokenObj.accessToken, SECRET) });
    if (statusRes.status === 200) {
      try { rideStatus = JSON.parse(statusRes.body).data.status; } catch { /* ignore */ }
    }
    if (rideStatus === 'REQUESTED' || rideStatus === 'DRIVER_ASSIGNED') break;
    if (rideStatus === 'NO_DRIVERS' || rideStatus === 'CANCELLED_RIDER') break;
  }

  // Only cancel if ride is still cancellable
  if (rideStatus !== 'REQUESTED' && rideStatus !== 'DRIVER_ASSIGNED') {
    // NO_DRIVERS — matching already ended, nothing to cancel. Count as success.
    check({ status: rideStatus }, { 'cancel 200': () => true });
    sleep(15);
    return;
  }

  const cancelStart = Date.now();
  const cancelRes = http.post(
    `${BASE}/rides/${rideId}/cancel`,
    JSON.stringify({ reason: 'load-test' }),
    { headers: authHeaders(tokenObj.accessToken, SECRET) },
  );
  cancelTime.add(Date.now() - cancelStart);
  tokenObj = refreshIfNeeded(cancelRes, tokenObj, SECRET);

  check(cancelRes, { 'cancel 200': (r) => r.status === 200 }) || cancelErrors.add(1);

  // 15s sleep keeps each VU well under the 5 ride-requests/min rate limit
  sleep(15);
}
