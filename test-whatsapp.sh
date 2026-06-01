#!/bin/bash
# WhatsApp bot test — simulates a full booking conversation
# Usage: bash test-whatsapp.sh [phone]
# Default phone is 919800000001 (fake test number)

BASE="https://hey-auto-server-production.up.railway.app/api/v1/whatsapp"
PHONE="${1:-919800000001}"
WA_FROM="whatsapp:+${PHONE}"
NAME="Test User"

send() {
  local body="$1"
  echo ""
  echo "──────────────────────────────────────"
  echo "📱 YOU: $body"
  curl -s -X POST "$BASE/webhook" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "From=$WA_FROM" \
    --data-urlencode "ProfileName=$NAME" \
    --data-urlencode "Body=$body" > /dev/null
  sleep 1
  local reply
  reply=$(curl -s "$BASE/dev-inbox/$PHONE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['message'] or '(no reply yet)')" 2>/dev/null || echo "(check server logs)")
  echo ""
  echo "🛺 BOT:"
  echo "$reply"
  echo ""
}

send_location() {
  echo ""
  echo "──────────────────────────────────────"
  echo "📍 YOU: [Shares GPS location: 12.0368, 75.3614]"
  curl -s -X POST "$BASE/webhook" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "From=$WA_FROM" \
    --data-urlencode "ProfileName=$NAME" \
    --data-urlencode "Body=Current Location" \
    --data-urlencode "Latitude=12.0368" \
    --data-urlencode "Longitude=75.3614" > /dev/null
  sleep 1
  local reply
  reply=$(curl -s "$BASE/dev-inbox/$PHONE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['message'] or '(no reply yet)')" 2>/dev/null || echo "(check server logs)")
  echo ""
  echo "🛺 BOT:"
  echo "$reply"
  echo ""
}

echo "======================================"
echo " WhatsApp Bot Test"
echo " Phone: +$PHONE"
echo " Server: $BASE"
echo "======================================"

send "Hi"
send "1"
send_location
send "Hospital"
send "YES"

echo "══════════════════════════════════════"
echo " Done! Check server logs for ride ID."
echo " Use Driver Simulator in admin console"
echo " to accept the ride."
echo "══════════════════════════════════════"
