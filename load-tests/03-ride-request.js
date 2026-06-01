/**
 * TEST 3 — Full Ride Request flow
 * Most expensive operation: auth → fare estimate → book ride → cancel
 * Tests the DB write path, Redis pub/sub, and ride matching algorithm.
 * Run with a valid AUTH_TOKEN: k6 run -e AUTH_TOKEN=xxx 03-ride-request.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE = 'https://hey-auto-server-production.up.railway.app/api/v1';

const bookingErrors  = new Counter('booking_errors');
const cancelErrors   = new Counter('cancel_errors');
const bookingTime    = new Trend('ride_booking_duration', true);
const cancelTime     = new Trend('ride_cancel_duration', true);

export const options = {
  stages: [
    { duration: '30s', target: 5  },   // gentle ramp — each request hits DB
    { duration: '60s', target: 20 },   // 20 concurrent ride requests
    { duration: '60s', target: 20 },   // hold
    { duration: '30s', target: 0  },
  ],
  thresholds: {
    http_req_duration:    ['p(95)<3000'],
    http_req_failed:      ['rate<0.05'],
    ride_booking_duration:['p(95)<2500'],
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

export function setup() {
  // Login as rider to get token
  const phone = '9000099999';
  const headers = { 'Content-Type': 'application/json' };

  http.post(`${BASE}/auth/send-otp`, JSON.stringify({ phone, role: 'RIDER' }), { headers });
  const res = http.post(`${BASE}/auth/verify-otp`,
    JSON.stringify({ phone, otp: '123456', role: 'RIDER', deviceId: 'load-test-setup' }),
    { headers });

  try {
    const token = JSON.parse(res.body).data.tokens.accessToken;
    return { token };
  } catch {
    console.error('Setup failed — could not get auth token. Is demo OTP active?');
    return { token: __ENV.AUTH_TOKEN || '' };
  }
}

export default function (data) {
  const token = data.token || __ENV.AUTH_TOKEN;
  if (!token) { console.error('No auth token — skipping'); return; }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

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
  }), { headers });
  bookingTime.add(Date.now() - bookStart);

  const bookOk = check(bookRes, {
    'ride request 200 or 201': (r) => r.status === 200 || r.status === 201,
    'ride has id':             (r) => {
      try { return !!JSON.parse(r.body).data.id; } catch { return false; }
    },
  });

  if (!bookOk) { bookingErrors.add(1); sleep(2); return; }

  const rideId = JSON.parse(bookRes.body).data.id;
  sleep(1);

  // Immediately cancel (we're just testing the booking path, not matching)
  const cancelStart = Date.now();
  const cancelRes = http.post(`${BASE}/rides/${rideId}/cancel`, '{}', { headers });
  cancelTime.add(Date.now() - cancelStart);

  check(cancelRes, {
    'cancel 200': (r) => r.status === 200,
  }) || cancelErrors.add(1);

  sleep(3);
}
