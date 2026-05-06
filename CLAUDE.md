# Aye Auto — Project Instructions

Zero-commission, driver-first auto-rickshaw booking app for Kerala (starting in Taliparamba, Kannur District). Drivers keep 100% of fares. Revenue comes from optional driver subscriptions. No Ola/Uber presence in small Kerala towns — that's the opportunity.

---

## Monorepo Structure

```
Hey Auto/
├── apps/
│   ├── rider-app/          React Native (Expo SDK 54) — rider-facing app
│   ├── driver-app/         React Native (Expo SDK 54) — driver-facing app
│   └── demo-dashboard/     Vanilla HTML/JS admin console (admin.html)
├── server/                 Node.js + Express + TypeScript + Prisma + PostgreSQL + Redis + Socket.io
├── docs/
│   ├── TECHNICAL_DESIGN_DOCUMENT.md
│   └── SOLUTION_DESIGN_DOCUMENT.md
└── CLAUDE.md               ← you are here
```

## Key Scripts (run from root)

```bash
npm run dev:server     # start backend
npm run docker:up      # start PostgreSQL + Redis via Docker
npm run db:migrate     # run Prisma migrations
npm run db:studio      # Prisma Studio
```

---

## Infrastructure

| Service | Detail |
|---------|--------|
| Backend | Railway — https://hey-auto-server-production.up.railway.app |
| Database | PostgreSQL on Railway |
| Cache / Pub-Sub | Redis on Railway |
| Maps | Google Maps API — key: AIzaSyBaOw8Yu2FKHSOSqnBbZNfPVBfJcD4J2i8 |
| SMS OTP | Fast2SMS (add FAST2SMS_API_KEY to Railway env to enable) |
| Push | Firebase FCM (not yet configured) |
| File Storage | AWS S3 or local fallback (S3 not yet configured — files lost on redeploy) |
| Railway deploy | `cd server && railway up` |

**API base:** `https://hey-auto-server-production.up.railway.app/api/v1`  
**Admin console:** `https://hey-auto-server-production.up.railway.app/admin`

---

## Theme & Branding

- App name: **Aye Auto** (not "Hey Auto" — Hey Auto is the company name)
- Primary colour: `#F5C800` (yellow)
- Background: `#1A1A2E` (dark navy/black)

---

## Mobile Apps

### EAS Build (Expo)
- Expo account: `rejesh` (rejesh@gmail.com)
- Rider project ID: `e81ff950-99f7-45d1-9a93-277920334268`
- Driver project ID: `63955e68-b790-4b60-a828-f1108e1bac6f`
- EAS CLI: `/usr/local/bin/eas`

**Build commands (run from each app directory):**
```bash
# Rider APK
cd apps/rider-app && eas build --platform android --profile preview --non-interactive

# Driver APK
cd apps/driver-app && eas build --platform android --profile preview --non-interactive
```

### Latest APKs (built 2026-05-02)
- Rider: https://expo.dev/artifacts/eas/jzMyMUuVfrF1nc93nMfEm1.apk
- Driver: https://expo.dev/artifacts/eas/jKW57UfnBp5JdiCP8ggqnn.apk

### Package IDs
- Rider: `in.heyauto.rider`
- Driver: `in.heyauto.driver`
- Both can be installed on the same Android phone simultaneously.

---

## Test Accounts

| Role | Phone | OTP | Notes |
|------|-------|-----|-------|
| Admin | +919999999999 | 123456 | |
| Driver | +918095481555 | 123456 | VERIFIED, has vehicle, subscription approved |
| Rider | any fresh 10-digit number | 123456 | |

- **Demo OTP:** `123456` works for any number when no SMS gateway is configured.
- **One-phone testing:** Install both APKs, use two different phone numbers. Driver Simulator in admin console acts as the second device.
- **Avoid:** +919986584443 (registered as ADMIN), +919876543210 (registered as DRIVER — wrong roles)

---

## Fare Engine (Kerala Gazette G.O.(P)No.14/2022/TRANS)

Implemented in `server/src/modules/ride/ride.service.ts`:

| Rule | Value |
|------|-------|
| Base fare | ₹30 for first 1.5 km |
| Per km rate | ₹15/km beyond 1.5 km |
| Per minute rate | ₹0 (Kerala is distance-only while moving) |
| Minimum fare | ₹30 |
| Night surcharge | +50% of total fare (22:00–05:00 IST) |
| Onward surcharge | +50% of amount above minimum (daytime, non-corporation towns) |
| Waiting charge | ₹10 per 15 min, max ₹250/day |

**IST timezone:** Railway runs UTC. `isNightTime()` in `server/src/utils/helpers.ts` adds +5:30 explicitly — do not change this.

---

## Ride Matching Algorithm

File: `server/src/modules/ride/ride.service.ts` → `findDriver()`

1. Find all drivers within `DRIVER_SEARCH_RADIUS_KM` (default 3 km) of pickup
2. Filter: `isOnline=true`, `isOnRide=false`, `city=pickup.city`
3. Score each driver:
   ```
   score = 0.4 × (1 - distance/radius)   // proximity
         + 0.3 × (rating/5)               // rating
         + 0.2 × (acceptanceRate/100)     // reliability
         + 0.1 × random()                 // fairness
   ```
4. Offer ride sequentially to top `MAX_MATCHING_ROUNDS` (default 3) drivers
5. Each driver gets `RIDE_REQUEST_TIMEOUT_SEC` (default 15s) to accept
6. If all decline/timeout → ride status = `NO_DRIVERS`

**Important:** Only the selected driver receives the Socket.io notification. The Driver Simulator in admin console has a fallback that polls the admin API for any `REQUESTED` ride in the last 30 seconds.

---

## Socket Events

| Event | Direction | Trigger |
|-------|-----------|---------|
| `ride:new_request` | Server → Driver | Ride matched to driver |
| `ride:driver_assigned` | Server → Rider | Driver accepted |
| `ride:driver_arrived` | Server → Rider | Driver marked arrived |
| `ride:started` | Server → Rider | OTP verified, ride started |
| `ride:completed` | Server → Both | Ride completed |
| `ride:cancelled` | Server → Both | Rider or driver cancelled |
| `ride:no_drivers` | Server → Rider | No drivers found after all rounds |

Socket transport: `['polling', 'websocket']` — polling must be first or connections fail on Railway.

---

## DB Migrations

Migrations in `server/prisma/migrations/`. Railway runs `prisma migrate deploy` on every deploy.

| Migration | What it does |
|-----------|-------------|
| `20260417175200_init` | Initial schema |
| `20260426161108_add_subscription_pending_status` | PENDING status for subscriptions |
| `20260504000000_add_fare_config_fields` | Adds `rides.onward_surcharge`, fare config fields — **critical, fixes fare estimate crash** |

---

## Completed Features

- Phone OTP auth (rider + driver)
- Rider: profile setup, edit, saved places, emergency contacts, payment methods
- Driver: registration, profile, documents upload, subscription (Daily/Weekly/Monthly), vehicle management
- Full ride flow: estimate → request → match → accept → arrive → OTP → start → complete → rate
- Two-way ratings, itemized receipt, SOS (calls 112), driver calls rider
- Admin console: dashboard, drivers, riders, documents, subscriptions, ride history, fare config editor, Driver Simulator
- Kerala gazette-compliant fare engine
- Push notifications (FCM scaffolded, token registration works)

---

## Pending / Next Steps

### Immediate
- [ ] Rebuild APKs (latest include fare estimate fix)
- [ ] Add `FAST2SMS_API_KEY` to Railway env (sign up at fast2sms.com — free ₹50 credit)
- [ ] Seed fare config in Railway DB (verify correct values saved via admin console)
- [ ] End-to-end test: book → accept (Driver Simulator) → arrive → OTP → complete → rate

### P2 — Pre-launch
- [ ] Firebase FCM — push when driver app is backgrounded
- [ ] AWS S3 / Cloudinary — document uploads lost on Railway redeploy
- [ ] Sentry error monitoring — `@sentry/node` + `@sentry/react-native`
- [ ] Driver earnings weekly bar chart on EarningsScreen.tsx
- [ ] Custom domain: heyauto.in

### P3 — Post-launch
- [ ] Play Store submission ($25 one-time)
- [ ] iOS build (Apple Developer account ₹9,000/year)
- [ ] Razorpay subscription automation (when >200 drivers)
- [ ] Surge pricing, scheduled rides, in-app chat, referral codes
- [ ] WhatsApp booking (module scaffolded at `server/src/modules/whatsapp/`)

---

## Important Conventions

- Phone numbers stored with `+91` prefix in DB; server adds `+91` if not present
- All monetary values in INR (₹), stored as `Float` in DB
- `city` field is lowercase string (e.g. `"taliparamba"`) — used for fare config lookup and driver matching
- Admin routes require `Authorization: Bearer <token>` with ADMIN role JWT
- OTP flow: 30s cooldown between requests, 5 max attempts, expires after `OTP_EXPIRY_SEC` (default 300s)
- Demo mode: when no SMS gateway configured, server returns OTP in response body and always accepts `123456`
