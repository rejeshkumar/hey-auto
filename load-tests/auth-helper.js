/**
 * Per-VU token manager for k6 load tests.
 *
 * Each VU gets its own rider/driver account derived from its VU number.
 * Tokens are stored in VU-local state and refreshed automatically when
 * a request returns 401 (expired access token).
 *
 * Usage:
 *   import { getToken, refreshIfNeeded } from './auth-helper.js';
 *
 *   export default function() {
 *     let token = getToken();
 *     const res = http.post(url, body, { headers: authHeaders(token) });
 *     token = refreshIfNeeded(res, token);
 *   }
 */
import http from 'k6/http';

const BASE = 'https://hey-auto-server-production.up.railway.app/api/v1';

// These phones are whitelisted in DEMO_OTP_PHONES on Railway.
// For load tests we derive unique phones per VU by combining with VU index.
// Phones 9200000001–9200000099 are the load-test pool.
// Add them to DEMO_OTP_PHONES if per-VU auth is needed, OR use LOAD_TEST_MODE
// server flag to bypass the whitelist entirely.
const RIDER_BASE_PHONE = 91000; // +9191000xxxxx → mapped to 10-digit via VU
const DRIVER_PHONE     = '8095481555'; // single known test driver

// VU-local token store (k6 runs each VU in its own goroutine — this is safe)
const _tokens = {};

export function loadTestHeaders(secret) {
  return secret ? { 'x-load-test': secret } : {};
}

export function authHeaders(token, secret) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...loadTestHeaders(secret),
  };
}

/**
 * Login a phone with OTP 123456 and return { accessToken, refreshToken }.
 * Handles the OTP cooldown by using a unique deviceId per call.
 */
export function login(phone, role, secret) {
  const headers = { 'Content-Type': 'application/json', ...loadTestHeaders(secret) };
  http.post(`${BASE}/auth/send-otp`, JSON.stringify({ phone, role }), { headers });
  const res = http.post(`${BASE}/auth/verify-otp`,
    JSON.stringify({ phone, otp: '123456', role, deviceId: `lt-${__VU}-${Date.now()}` }),
    { headers });
  try {
    const d = JSON.parse(res.body).data;
    return { accessToken: d.tokens.accessToken, refreshToken: d.tokens.refreshToken };
  } catch {
    console.error(`[VU ${__VU}] login failed for ${phone}: ${res.body}`);
    return null;
  }
}

/**
 * Use the refresh token to get a new access token.
 */
export function refresh(refreshToken, secret) {
  const headers = { 'Content-Type': 'application/json', ...loadTestHeaders(secret) };
  const res = http.post(`${BASE}/auth/refresh-token`,
    JSON.stringify({ refreshToken }),
    { headers });
  try {
    return JSON.parse(res.body).data.tokens.accessToken;
  } catch {
    return null;
  }
}

/**
 * Returns a unique rider phone for this VU: 91100000VU (10 digits).
 * VU 1 → 9110000001, VU 50 → 9110000050, etc.
 */
export function vuRiderPhone() {
  return `91100000${String(__VU).padStart(2, '0')}`;
}

/**
 * Get or create a VU-local token. Call once at the top of the default function.
 * Pass role = 'RIDER' | 'DRIVER'. For drivers, all VUs share the test driver phone.
 */
export function getOrLogin(role, secret) {
  const key = `${__VU}_${role}`;
  if (_tokens[key] && _tokens[key].accessToken) return _tokens[key];
  const phone = role === 'DRIVER' ? DRIVER_PHONE : vuRiderPhone();
  const tokens = login(phone, role, secret);
  if (tokens) _tokens[key] = tokens;
  return _tokens[key] || null;
}

/**
 * If the last response was 401, use the refresh token to get a new access token.
 * Returns the (possibly updated) token object.
 */
export function refreshIfNeeded(res, tokenObj, secret) {
  if (!tokenObj || res.status !== 401) return tokenObj;
  const key = `${__VU}_${tokenObj._role || 'RIDER'}`;
  const newAccess = refresh(tokenObj.refreshToken, secret);
  if (newAccess) {
    _tokens[key] = { ...tokenObj, accessToken: newAccess };
    return _tokens[key];
  }
  // Refresh failed — re-login
  return getOrLogin(tokenObj._role || 'RIDER', secret);
}
