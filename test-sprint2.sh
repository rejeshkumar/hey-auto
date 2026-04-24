#!/usr/bin/env bash
# Sprint 2 end-to-end test
# Usage: BASE_URL=https://your-app.railway.app ./test-sprint2.sh
# Default: local dev server

BASE="${BASE_URL:-http://localhost:3000}"
API="$BASE/api/v1"
echo "Testing against: $API"
echo ""

fail() { echo "FAIL: $1"; exit 1; }
pass() { echo "PASS: $1"; }

# ── 1. Health check ──────────────────────────────────────────────
echo "=== Health ==="
HEALTH=$(curl -sf "$BASE/health") || fail "Server not reachable"
echo "$HEALTH" | grep -q '"status":"healthy"' && pass "Health check" || fail "Health response: $HEALTH"
echo ""

# ── 2. Register & login driver ───────────────────────────────────
echo "=== Driver auth ==="
DRIVER_PHONE="9$(shuf -i 100000000-999999999 -n1)"
echo "Driver phone: $DRIVER_PHONE"

curl -sf -X POST "$API/auth/send-otp" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$DRIVER_PHONE\",\"role\":\"DRIVER\"}" > /dev/null || fail "Driver send-otp"
pass "Driver OTP sent"

DRIVER_AUTH=$(curl -sf -X POST "$API/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$DRIVER_PHONE\",\"otp\":\"123456\",\"role\":\"DRIVER\"}") || fail "Driver verify-otp"
DRIVER_TOKEN=$(echo "$DRIVER_AUTH" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
DRIVER_USER_ID=$(echo "$DRIVER_AUTH" | grep -o '"userId":"[^"]*"' | cut -d'"' -f4)
[ -n "$DRIVER_TOKEN" ] || fail "No driver token in: $DRIVER_AUTH"
pass "Driver logged in (userId: $DRIVER_USER_ID)"
echo ""

# ── 3. Complete driver profile ────────────────────────────────────
echo "=== Driver profile ==="
curl -sf -X POST "$API/auth/complete-profile" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Test Driver","language":"ml"}' > /dev/null || fail "complete-profile"
pass "Profile completed"

curl -sf -X PUT "$API/driver/profile" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"licenseNumber":"KL13 20240001","city":"Taliparamba"}' > /dev/null || fail "update driver profile"
pass "Driver profile updated"
echo ""

# ── 4. Add vehicle ────────────────────────────────────────────────
echo "=== Vehicle ==="
VEHICLE=$(curl -sf -X POST "$API/driver/vehicles" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"make":"Bajaj","model":"RE","year":2022,"plateNumber":"KL 13 AB 1234","vehicleType":"AUTO","color":"Yellow"}') || fail "add vehicle: $VEHICLE"
VEHICLE_ID=$(echo "$VEHICLE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
pass "Vehicle added (id: $VEHICLE_ID)"
echo ""

# ── 5. Upload document ────────────────────────────────────────────
echo "=== Documents ==="
curl -sf -X POST "$API/driver/documents" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"docType":"LICENSE","docUrl":"https://example.com/license.jpg","docNumber":"KL13 20240001"}' > /dev/null || fail "upload document"
pass "Document uploaded"
echo ""

# ── 6. Update driver location ─────────────────────────────────────
echo "=== Location ==="
curl -sf -X PUT "$API/driver/location" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"lat":11.9462,"lng":75.4928}' > /dev/null || fail "update location"
pass "Location updated (Taliparamba)"
echo ""

# ── 7. Verify driver profile status ──────────────────────────────
echo "=== Verify status before go-online ==="
PROFILE=$(curl -sf "$API/driver/profile" \
  -H "Authorization: Bearer $DRIVER_TOKEN") || fail "get profile"
VSTATUS=$(echo "$PROFILE" | grep -o '"verificationStatus":"[^"]*"' | cut -d'"' -f4)
echo "  verificationStatus: $VSTATUS"
if [ "$VSTATUS" != "VERIFIED" ]; then
  echo "  NOTE: Driver not verified. Need admin to verify or use DB. Checking via admin..."
  # Try admin verification
  ADMIN_PHONE="9000000099"
  curl -sf -X POST "$API/auth/send-otp" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"$ADMIN_PHONE\",\"role\":\"ADMIN\"}" > /dev/null 2>&1
  ADMIN_AUTH=$(curl -sf -X POST "$API/auth/verify-otp" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"$ADMIN_PHONE\",\"otp\":\"123456\",\"role\":\"ADMIN\"}" 2>/dev/null)
  ADMIN_TOKEN=$(echo "$ADMIN_AUTH" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
  if [ -n "$ADMIN_TOKEN" ]; then
    echo "  Got admin token, verifying driver..."
    DOCS=$(curl -sf "$API/admin/drivers?status=PENDING" \
      -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
    echo "  Admin driver list: $(echo $DOCS | head -c 200)"
  else
    echo "  SKIP: Admin login failed — verify driver manually in DB"
    echo "  SQL: UPDATE driver_profiles SET verification_status='VERIFIED' WHERE user_id='$DRIVER_USER_ID';"
  fi
fi
echo ""

# ── 8. Register & login rider ─────────────────────────────────────
echo "=== Rider auth ==="
RIDER_PHONE="9$(shuf -i 100000000-999999999 -n1)"
echo "Rider phone: $RIDER_PHONE"

curl -sf -X POST "$API/auth/send-otp" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$RIDER_PHONE\",\"role\":\"RIDER\"}" > /dev/null || fail "Rider send-otp"

RIDER_AUTH=$(curl -sf -X POST "$API/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$RIDER_PHONE\",\"otp\":\"123456\",\"role\":\"RIDER\"}") || fail "Rider verify-otp"
RIDER_TOKEN=$(echo "$RIDER_AUTH" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
[ -n "$RIDER_TOKEN" ] || fail "No rider token in: $RIDER_AUTH"

curl -sf -X POST "$API/auth/complete-profile" \
  -H "Authorization: Bearer $RIDER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Test Rider","language":"ml"}' > /dev/null

pass "Rider logged in"
echo ""

# ── 9. Fare estimate ──────────────────────────────────────────────
echo "=== Fare estimate ==="
FARE=$(curl -sf -X POST "$API/rides/estimate" \
  -H "Authorization: Bearer $RIDER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pickupLat":11.9462,"pickupLng":75.4928,
    "dropoffLat":11.9812,"dropoffLng":75.3644,
    "pickupAddress":"Taliparamba Bus Stand",
    "dropoffAddress":"Kannapuram Railway Station"
  }') || fail "fare estimate: $FARE"
EST_FARE=$(echo "$FARE" | grep -o '"estimatedFare":[0-9.]*' | cut -d: -f2)
pass "Fare estimate: ₹$EST_FARE"
echo ""

# ── 10. Summary ───────────────────────────────────────────────────
echo "=== Sprint 2 Test Summary ==="
echo "Driver: $DRIVER_PHONE (userId: $DRIVER_USER_ID)"
echo "Rider:  $RIDER_PHONE"
echo ""
echo "Remaining manual steps (require verified driver):"
echo "  1. Set verificationStatus=VERIFIED in DB for driver $DRIVER_USER_ID"
echo "  2. POST $API/driver/online  (Bearer \$DRIVER_TOKEN)"
echo "  3. POST $API/rides  (Bearer \$RIDER_TOKEN) — request ride"
echo "  4. GET  $API/driver/ride-request  (Bearer \$DRIVER_TOKEN) — poll"
echo "  5. POST $API/rides/<rideId>/accept  (Bearer \$DRIVER_TOKEN)"
echo "  6. POST $API/rides/<rideId>/arrived"
echo "  7. POST $API/rides/<rideId>/start  {\"otp\":\"<otp>\"}"
echo "  8. POST $API/rides/<rideId>/complete"
echo "  9. POST $API/rides/<rideId>/rate  {\"rating\":5}"
echo ""
echo "Done."
