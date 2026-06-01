#!/bin/bash
# Run all load tests in sequence with a summary report
# Usage: ./run-all.sh
# Requires: k6 installed (brew install k6)

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS_DIR="$BASE_DIR/results"
mkdir -p "$RESULTS_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Aye Auto — Load Test Suite             ║"
echo "║   Target: Railway production server      ║"
echo "╚══════════════════════════════════════════╝"
echo ""

run_test() {
  local NUM=$1
  local NAME=$2
  local FILE=$3
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Test $NUM: $NAME"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  k6 run \
    --out json="$RESULTS_DIR/${TIMESTAMP}_test${NUM}.json" \
    --summary-export="$RESULTS_DIR/${TIMESTAMP}_test${NUM}_summary.json" \
    "$BASE_DIR/$FILE"
  echo ""
  echo "  ✓ Results saved to results/${TIMESTAMP}_test${NUM}_summary.json"
  echo ""
  sleep 10  # give server a breather between tests
}

run_test 1 "Auth / OTP"              "01-auth.js"
run_test 2 "Fare Estimate (100 VUs)" "02-fare-estimate.js"
run_test 3 "Ride Request + Cancel"   "03-ride-request.js"
run_test 4 "Driver Location (50 VUs, 3min)" "04-location-updates.js"
run_test 5 "Spike Test (50 users in 5s)"    "05-spike.js"

echo "╔══════════════════════════════════════════╗"
echo "║   All tests complete                     ║"
echo "║   Results in: load-tests/results/        ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Key things to check in results:"
echo "  • p(95) response time < 2000ms for auth/booking"
echo "  • p(95) response time < 500ms for location updates"
echo "  • Error rate < 5% under normal load"
echo "  • Error rate < 10% during spike"
echo "  • Server does NOT crash after spike (recovery test)"
