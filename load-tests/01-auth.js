/**
 * TEST 1 — Auth / OTP flow
 * Simulates users requesting OTP and logging in simultaneously.
 * Ramps from 1 to 50 concurrent users over 2 minutes.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE = 'https://hey-auto-server-production.up.railway.app/api/v1';

const otpErrors   = new Counter('otp_errors');
const loginErrors = new Counter('login_errors');
const otpDuration = new Trend('otp_send_duration', true);
const loginDuration = new Trend('otp_verify_duration', true);

export const options = {
  stages: [
    { duration: '30s', target: 10  },  // ramp to 10 users
    { duration: '60s', target: 50  },  // ramp to 50 users
    { duration: '60s', target: 50  },  // hold at 50
    { duration: '30s', target: 0   },  // ramp down
  ],
  thresholds: {
    http_req_duration:     ['p(95)<2000'],  // 95% of requests under 2s
    http_req_failed:       ['rate<0.05'],   // less than 5% errors
    otp_send_duration:     ['p(95)<1500'],
    otp_verify_duration:   ['p(95)<1500'],
  },
};

// Pool of DEMO_OTP_PHONES whitelisted in Railway — VUs cycle through these
const DEMO_PHONES = ['9999999999', '8095481555'];

export default function () {
  // Cycle through whitelisted phones — prod blocks phones not in DEMO_OTP_PHONES
  const phone = DEMO_PHONES[__VU % DEMO_PHONES.length];

  const headers = { 'Content-Type': 'application/json' };

  // Step 1: Send OTP
  const sendStart = Date.now();
  const sendRes = http.post(`${BASE}/auth/send-otp`,
    JSON.stringify({ phone, role: 'RIDER' }), { headers });
  otpDuration.add(Date.now() - sendStart);

  const sendOk = check(sendRes, {
    'send-otp status 200 or 429': (r) => r.status === 200 || r.status === 429,
    'send-otp success or cooldown': (r) => {
      try {
        const b = JSON.parse(r.body);
        return b.success === true || b.error?.code === 'COOLDOWN';
      } catch { return false; }
    },
  });
  if (!sendOk) { otpErrors.add(1); return; }

  sleep(1);

  // Step 2: Verify OTP
  const verifyStart = Date.now();
  const verifyRes = http.post(`${BASE}/auth/verify-otp`,
    JSON.stringify({ phone, otp: '123456', role: 'RIDER', deviceId: `load-test-${__VU}-${__ITER}` }),
    { headers });
  loginDuration.add(Date.now() - verifyStart);

  const verifyOk = check(verifyRes, {
    'verify-otp 200 or 400': (r) => r.status === 200 || r.status === 400,
    'verify-otp has token or err': (r) => {
      try {
        const b = JSON.parse(r.body);
        return !!b.data?.tokens?.accessToken || !!b.error;
      } catch { return false; }
    },
  });
  if (!verifyOk) loginErrors.add(1);

  sleep(2);
}
