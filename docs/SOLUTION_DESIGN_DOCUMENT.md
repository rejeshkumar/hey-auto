# Hey Auto — Solution Design Document (SDD)
**Version:** 1.0  
**Date:** 2026-04-27  
**Prepared for:** Developer Handover  
**Product:** Hey Auto — Zero-commission Auto-rickshaw Booking Platform

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Business Requirements](#2-business-requirements)
3. [Stakeholders & User Roles](#3-stakeholders--user-roles)
4. [Feature Inventory — What Is Built](#4-feature-inventory--what-is-built)
5. [Feature Backlog — What Is Not Built Yet](#5-feature-backlog--what-is-not-built-yet)
6. [System Flows — End to End](#6-system-flows--end-to-end)
7. [Data Flow Diagram](#7-data-flow-diagram)
8. [Security Design](#8-security-design)
9. [Deployment Architecture](#9-deployment-architecture)
10. [Scaling Considerations](#10-scaling-considerations)
11. [Operational Runbook](#11-operational-runbook)
12. [Sprint Roadmap Recommendation](#12-sprint-roadmap-recommendation)
13. [Handover Checklist](#13-handover-checklist)

---

## 1. Executive Summary

Hey Auto is a hyperlocal, zero-commission auto-rickshaw booking app targeting small Kerala towns where Ola and Uber have no presence. The platform consists of:

- **Rider app** — Book an auto, track driver, pay at destination
- **Driver app** — Accept rides, navigate, manage subscription, upload KYC documents
- **Admin console** — Verify drivers, approve subscriptions, configure fares, monitor operations
- **Backend server** — REST API + WebSocket server handling all business logic

The platform is **feature-complete for MVP** as of April 2026. All critical flows — auth, ride booking end-to-end, driver subscriptions, KYC document upload, push notifications, and admin operations — are implemented and working.

### Revenue Model
Drivers pay ₹25/day subscription to access the platform. Riders pay drivers directly. No ride commission.

---

## 2. Business Requirements

### BR-01: Driver Onboarding
- Driver registers with phone + OTP
- Uploads 7 KYC documents (driving license, vehicle RC, insurance, permit, Aadhaar, photo, vehicle photo)
- Admin verifies documents manually
- Driver pays daily subscription via UPI → submits UTR → admin approves
- Driver can go online only after verification + active subscription

### BR-02: Ride Booking
- Rider enters pickup + destination
- System shows fare estimate with itemized breakdown before booking
- System matches nearest available verified driver within 3 km
- Driver sees request for 15 seconds; if no response, next driver is tried
- 4-digit OTP prevents fake trip starts
- Both parties see each other's location during the ride
- Rider rates driver; driver rates rider after trip completion

### BR-03: Fare & Payment
- Fare = flat base fare + per-km + per-minute + night surcharge (25% between 10 PM – 5 AM)
- Fare config is city-specific and admin-editable
- Payment: cash to driver by default (UPI integration ready via Razorpay)
- Rider can add a tip at ride completion

### BR-04: Safety
- Rider can trigger SOS: calls 112 + notifies all emergency contacts via push
- Emergency contacts managed in rider profile

### BR-05: Admin Operations
- Single admin account (seeded)
- Dashboard shows live operational stats
- Document verification with image preview
- Subscription approval via UTR lookup in bank statement

---

## 3. Stakeholders & User Roles

| Role | App | Access Level |
|---|---|---|
| **Rider** | Rider App (iOS/Android) | Book rides, manage profile, emergency contacts |
| **Driver** | Driver App (iOS/Android) | Accept rides, navigate, manage subscription and documents |
| **Admin** | Browser (admin.html) | Full platform management |

### Role assignment
- Role is set at registration time and stored in `users.role`
- JWT payload includes `role` — backend middleware enforces it on every route
- A phone number can only hold one role (no dual accounts on same number)

---

## 4. Feature Inventory — What Is Built

### ✅ Authentication
- Phone OTP login for rider and driver
- Twilio integration for SMS delivery (console log fallback in dev)
- JWT access token (15 min) + refresh token (30 days)
- Refresh token rotation with device ID tracking
- Session persistence in MMKV storage

### ✅ Driver KYC & Onboarding
- Profile setup (name, language, city, Aadhaar, license number)
- Vehicle registration (registration number, type, fuel, color, year)
- Document upload for 7 types via camera or gallery
- Images uploaded to AWS S3 (or local `uploads/` folder in dev)
- Admin reviews and approves/rejects each document individually
- Rejection reason shown to driver in app with re-upload option

### ✅ Driver Subscription
- Subscription plans configured by admin in DB
- 3-step flow in app: view plans → pay via UPI deep link → enter UTR
- UTR submitted creates a PENDING subscription record
- Admin approves after verifying against bank statement
- Driver gets push notification on approval
- Go-online blocked with SUBSCRIPTION_REQUIRED error if not subscribed

### ✅ Ride Flow (full lifecycle)
- Fare estimate with itemized breakdown + route polyline on map
- Ride request → driver matching (scored: proximity × rating × acceptance rate)
- Up to 3 matching rounds, 15 seconds each, expanding radius
- Socket event delivery for all state transitions
- Driver OTP verification before trip start
- Real-time driver GPS streaming to rider's map
- Turn-by-turn navigation banner in driver app (route polyline)
- Actual fare calculated at completion (based on real distance/time)
- Itemized receipt shown to rider

### ✅ Ratings
- Rider rates driver (1–5 stars + optional tip) at ride completion
- Driver rates rider at ride completion
- Average rating auto-updated on both profiles

### ✅ Push Notifications
- Both apps register Expo push token on login
- FCM via Firebase Admin SDK (optional — degrades gracefully)
- 6 ride lifecycle events + subscription + document events

### ✅ Safety (SOS)
- SOS button on rider's active ride screen
- Confirmation alert → calls 112 via native dialer
- Server logs SAFETY notification to DB
- Push notification sent to all emergency contacts

### ✅ Admin Console
- Dashboard with live stats
- Driver management: list, search, filter, verify, document checklist
- Rider management: list, search
- Document verification with image lightbox
- Subscription approval workflow
- Ride history with filters
- Fare configuration editor

---

## 5. Feature Backlog — What Is Not Built Yet

### P1 — Critical for production

#### [SUB-FIX-01] Fix Prisma Migration File
**What:** One migration SQL file is missing one line. The database is correct but `prisma migrate reset` would not fully replay it.  
**File:** `server/prisma/migrations/20260426161108_add_subscription_pending_status/migration.sql`  
**Fix:** Add `ALTER TABLE driver_subscriptions ALTER COLUMN status SET DEFAULT 'PENDING';` to the end of the file.  
**Effort:** 5 minutes.

---

### P2 — High priority for public launch

#### [PAY-01] Razorpay In-App UPI Payment
**What:** Allow rider to pay via UPI inside the app instead of cash-to-driver.  
**Why:** Safer, trackable, enables digital revenue.  
**What's ready:** Razorpay SDK installed, `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` in env schema, `Payment` model exists in DB, `paymentMethod` and `paymentStatus` fields on rides.  
**What to build:**
1. `POST /payments/create-order` → create Razorpay order, return `orderId` + `key`
2. Rider app: show Razorpay checkout after ride completion (if UPI selected)
3. `POST /payments/webhook` → verify signature, update `payments.status` + `rides.paymentStatus`
4. Admin dashboard: show payment status per ride

**Effort:** 2–3 days.

---

#### [SCREEN-01] Rider Ride History Screen
**What:** Screen showing past rides for the rider.  
**What's ready:** `GET /rides` (filtered by riderId) endpoint exists on the server.  
**What to build:** `apps/rider-app/src/features/history/HistoryScreen.tsx` — flat list of rides with date, route, fare, status.  
**Effort:** 1 day.

---

#### [SCREEN-02] Driver Earnings Chart
**What:** Visual weekly/monthly earnings chart in the driver app.  
**What's ready:** `GET /driver/earnings` endpoint returns today/week/month/total.  
**What to build:** Add bar chart (e.g. `react-native-chart-kit`) to `EarningsScreen.tsx` showing daily earnings for the past 7 days.  
**Effort:** 1 day.

---

#### [OPS-01] Sentry Error Monitoring
**What:** Catch and report runtime errors from all 3 surfaces (rider app, driver app, server).  
**What's ready:** `SENTRY_DSN` in env schema.  
**What to build:**
- Server: `npm install @sentry/node` → `Sentry.init()` in `app.ts`, plug into error handler middleware
- Apps: `npx expo install @sentry/react-native` → init in `index.js` with `SENTRY_DSN` from app config  
**Effort:** Half a day.

---

### P3 — Growth features

#### [FEAT-01] Surge Pricing
**What:** Increase fare multiplier during peak hours or high demand.  
**Design:** Add `surge_multiplier` column to `fare_configs` (default 1.0). Admin sets it in console. Fare engine applies it after base calculation. Show "Surge pricing in effect" badge in rider app.  
**Effort:** 1 day.

#### [FEAT-02] Scheduled Rides
**What:** Rider books a ride for a future time (e.g. airport at 6 AM next day).  
**Design:** Add `scheduled_at TIMESTAMPTZ` to rides. Status = `SCHEDULED`. Cron job (node-cron or Bull queue) runs every minute, picks rides due within next 2 minutes, triggers matching.  
**Effort:** 2 days.

#### [FEAT-03] In-App Chat
**What:** Text chat between rider and driver during active ride.  
**Design:** Socket.io already running. Add `chat:message` event. Store messages in a `chat_messages` table (`rideId`, `senderId`, `text`, `sentAt`). Build chat UI in both apps.  
**Effort:** 2 days.

#### [FEAT-04] Referral / Promo Codes
**What:** Riders enter a promo code for a discount on first ride.  
**Design:** `PromoCode` model (code, discountType, discountValue, maxUses, expiresAt). Rider enters code at booking. Discount subtracted from estimated fare. Tracked in `promo_redemptions`.  
**Effort:** 2 days.

#### [FEAT-05] WhatsApp Booking
**What:** Riders book an auto by sending a message to a WhatsApp Business number.  
**What's scaffolded:** `whatsapp` module in server with route handler and Redis event listener.  
**What to build:** Handle incoming WhatsApp messages, parse intent (pickup/drop location), trigger same ride request flow, send updates back via WhatsApp messages.  
**Effort:** 3–4 days.

---

## 6. System Flows — End to End

### Flow 1: Driver Onboarding

```
Driver downloads app
    ↓
Enters phone → OTP received (Twilio) → JWT issued
    ↓
Profile setup: name, language, city, Aadhaar, license number
    ↓
Vehicle registration: reg no, type, fuel, color
    ↓
Document upload × 7:
  - Takes photo via camera or gallery
  - App sends multipart/form-data to POST /driver/documents
  - Server uploads to S3 → stores URL in DB
  - Status: PENDING
    ↓
Admin reviews documents in console:
  - Opens image lightbox
  - Clicks Verify or Reject (with reason)
  - Driver gets push notification
    ↓
Subscription purchase:
  - Driver opens Subscription screen
  - Selects plan (₹25/day)
  - UPI deep link opens payment app
  - Driver pays, returns to Hey Auto app
  - Enters 12-digit UTR number
  - Status: PENDING
    ↓
Admin approves UTR:
  - Checks bank statement
  - Clicks Approve in console
  - driver_subscriptions.status → ACTIVE
  - Driver gets push: "Subscription activated!"
    ↓
Driver can now go Online ✓
```

---

### Flow 2: Ride Booking

```
Rider opens app → map shows nearby auto icons
    ↓
Taps pickup field → searches address (Google Places)
    ↓
Taps drop field → searches address
    ↓
Taps "Get Fare Estimate"
  → POST /rides/estimate
  → Server: Google Maps route → fare calculation
  → App shows: Base ₹30 + Distance ₹X + Time ₹Y + Night ₹Z = Total ₹T
    ↓
Rider taps "Book Auto"
  → POST /rides/request
  → Server creates ride record in DB with REQUESTED status
  → Matching engine finds up to 5 nearby verified drivers
  → Redis publishes ride:new_request to each driver's socket
    ↓
Driver sees request card (15 second countdown):
  - Pickup / drop addresses
  - Estimated fare
  - Distance from driver
  - Rider name + phone
    ↓
Driver taps "Accept"
  → POST /rides/:id/accept
  → Ride status → DRIVER_ASSIGNED
  → Redis publishes ride:driver_assigned
  → Rider sees: driver name, vehicle, rating, live location on map
    ↓
Driver drives to pickup, taps "I've Arrived"
  → POST /rides/:id/arrived
  → Ride status → DRIVER_ARRIVED
  → Rider receives OTP (4 digits shown on screen)
    ↓
Driver asks rider for OTP, taps "Start Ride" → enters OTP
  → POST /rides/:id/start { otp: "1234" }
  → Server verifies OTP
  → Ride status → IN_PROGRESS
  → Driver app shows navigation; rider app shows live tracking
    ↓
Driver reaches destination, taps "Complete Ride"
  → POST /rides/:id/complete
  → Server calculates actual fare (real distance/time from GPS)
  → Ride status → COMPLETED
  → Rider sees itemized receipt:
      Base: ₹30 | Distance: ₹X | Time: ₹Y | Night: ₹Z | Tip: ₹T
      Total: ₹___
    ↓
Rider rates driver (1–5 stars + tip)
Driver rates rider (1–5 stars)
```

---

### Flow 3: Admin Document Verification

```
Admin opens http://localhost:3000/admin
    ↓
Logs in with admin credentials
    ↓
Documents tab → filter: PENDING
    ↓
Sees list of unverified documents with driver name, doc type
    ↓
Clicks document → lightbox opens showing uploaded image (S3 URL)
    ↓
Admin clicks "Verify" or "Reject"
  If Reject → types rejection reason
    ↓
PUT /admin/documents/:id/verify { action: 'APPROVE' | 'REJECT', rejectionReason? }
  → document_status updated
  → Push notification sent to driver
    ↓
When all 7 documents verified:
  → driver_profiles.verification_status → VERIFIED
  → Driver can proceed to subscription
```

---

## 7. Data Flow Diagram

```
                    ┌──────────────┐
                    │  Rider App   │
                    └──────┬───────┘
                           │ REST + WS
                    ┌──────▼───────┐
                    │              │
      ┌─────────────►  API Server  ◄─────────────┐
      │             │              │              │
      │             └──────┬───────┘              │
      │                    │                      │
      │              ┌─────▼──────┐               │
      │              │ PostgreSQL │               │
      │              │  (Prisma)  │               │
      │              └─────┬──────┘               │
      │                    │                      │
      │              ┌─────▼──────┐         ┌─────┴──────┐
      │              │   Redis    │         │ Driver App │
      │              │ pub/sub +  │         └────────────┘
      │              │  cache    │
      │              └─────┬──────┘
      │                    │
      │              ┌─────▼──────┐
      │              │ Socket.io  │
      │              │  Server    │
      │              └─────┬──────┘
      │                    │ WebSocket
      └────────────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
   ┌─────▼──────┐       ┌──────▼─────┐
   │ AWS S3     │       │  Firebase  │
   │ (doc imgs) │       │  (FCM push)│
   └────────────┘       └────────────┘
```

**Redis serves two purposes:**
1. **Pub/Sub** — ride events published by ride service, consumed by Socket.io handler (decouples HTTP request handling from WebSocket delivery)
2. **Cache** — active ride lookups (`active_ride:<driverId>`) for fast driver location streaming

---

## 8. Security Design

### Authentication
- Phone OTP is the sole authentication factor
- OTP expires in 5 minutes (`OTP_EXPIRY_SEC`)
- OTP stored in Redis with TTL (not in DB)
- JWT access tokens: 15 min expiry, signed with HS256
- Refresh tokens: 30 day expiry, stored in DB, invalidated on logout
- Max 3 OTP requests per minute per phone (rate limiter middleware)

### API Security
- All routes protected by `authenticate` middleware (JWT verify)
- Role-based access: `authorize('DRIVER')`, `authorize('RIDER')`, `authorize('ADMIN')` middleware on every route group
- Request validation via Zod schemas — invalid payloads return 400 before hitting business logic
- Rate limiting: 100 requests per 15 minutes per IP in production (1000 in dev)
- Helmet.js for HTTP security headers
- CORS enabled (wildcard in dev; restrict in production to `heyauto.in`)

### Socket Security
- JWT token required in socket handshake: `io(URL, { auth: { token } })`
- `authenticateSocket()` middleware verifies token before any event handler runs
- Drivers join `drivers` room; users join `user:<userId>` room
- Ride events fan out to specific user rooms — no cross-user data leakage

### Data Security
- Passwords: not stored (OTP-only auth)
- Aadhaar number: stored as plain text in DB — **recommendation: encrypt before production**
- Document images: stored in S3 with IAM-controlled access
- `.env` file never committed (add to `.gitignore`)
- Database credentials separated per environment

### Recommendations Before Production
1. Encrypt Aadhaar numbers at rest (AES-256 via `crypto` module)
2. Restrict CORS to `heyauto.in` domain
3. Enable S3 bucket versioning + server-side encryption
4. Add `fail2ban` or IP blocklist at load balancer for repeated OTP abuse
5. Create IAM user for S3 with PutObject-only permission (not admin keys)

---

## 9. Deployment Architecture

### Recommended Production Setup

```
Internet
    │
    ▼
CloudFlare (DNS + DDoS protection)
    │
    ▼
Load Balancer (AWS ALB / nginx)
    │
    ├──── /api/* ──────→ Node.js server (EC2 / ECS) :3000
    ├──── /admin ──────→ Node.js server (serves static HTML)
    └──── /uploads/* ──→ S3 (or Node.js fallback)
                │
         ┌──────┴──────┐
         │             │
    PostgreSQL      Redis
    (RDS)          (ElastiCache)
```

### Minimum server spec for Phase 1 (Taliparamba)
- **EC2 t3.small** (2 vCPU, 2 GB RAM) — handles ~50 concurrent drivers comfortably
- **RDS db.t3.micro** PostgreSQL 15
- **ElastiCache t3.micro** Redis 7
- **S3** standard for document storage

### Estimated monthly cost (AWS ap-south-1)
| Service | Spec | Cost/month |
|---|---|---|
| EC2 t3.small | On-demand | ~₹1,200 |
| RDS db.t3.micro | Single-AZ | ~₹900 |
| ElastiCache t3.micro | Single node | ~₹600 |
| S3 | 10 GB storage + requests | ~₹200 |
| Data transfer | 50 GB | ~₹350 |
| **Total** | | **~₹3,250/month** |

### Docker (local / staging)
`docker-compose.yml` at repo root starts PostgreSQL 15 + Redis 7.  
Command: `npm run docker:up`

### Building for production
```bash
cd server
npm run build       # tsc → dist/
node dist/app.js    # production start

# Or with PM2:
pm2 start dist/app.js --name heyauto-server
pm2 startup
pm2 save
```

---

## 10. Scaling Considerations

### Current single-node architecture supports:
- ~50 concurrent online drivers (socket connections)
- ~100 ride requests/hour
- Sufficient for Taliparamba Phase 1 (est. 30–80 drivers)

### Scaling path (when needed):

**Horizontal scaling (Phase 2 — multi-city):**
- Socket.io already uses Redis pub/sub adapter pattern (ride events go through Redis) — adding a Redis Socket.io adapter (`@socket.io/redis-adapter`) makes multi-node deployment straightforward
- Move file uploads to S3 (already implemented, just needs credentials)
- Add connection pooling (PgBouncer) in front of PostgreSQL

**Database scaling:**
- Add read replicas for analytics/admin queries
- Partition `rides` table by `created_at` after ~1M rows

**Notification scaling:**
- Batch FCM sends for broadcasts (e.g. promo notifications)
- Move to a queue (Bull + Redis) for fire-and-forget push notifications

---

## 11. Operational Runbook

### Health check
```
GET http://localhost:3000/health
→ { status: "healthy", timestamp: "...", version: "v1", uptime: 3600 }
```
Returns 503 if Postgres or Redis is unreachable.

### Admin account
Created by `npm run db:seed`. Check `server/prisma/seed.ts` for the seeded phone number. Log into admin console at `/admin` using that number + OTP.

### Reset a driver's subscription manually
```sql
UPDATE driver_subscriptions
SET status = 'ACTIVE', expires_at = now() + interval '1 day'
WHERE driver_id = (SELECT id FROM driver_profiles WHERE user_id = '<user-uuid>');
```

### Force-complete a stuck ride
```sql
UPDATE rides
SET status = 'COMPLETED', completed_at = now(), actual_fare = estimated_fare, total_amount = estimated_fare
WHERE id = '<ride-uuid>' AND status NOT IN ('COMPLETED', 'CANCELLED_RIDER', 'CANCELLED_DRIVER');
```

### Check Redis pub/sub is working
```bash
redis-cli subscribe ride_events
# In another terminal, trigger a ride request — you should see JSON messages appear
```

### View server logs (production with PM2)
```bash
pm2 logs heyauto-server
pm2 logs heyauto-server --lines 200
```

### Add a new city
1. Insert a fare config row:
```sql
INSERT INTO fare_configs (id, city, vehicle_type, base_fare, base_distance_km, per_km_rate, per_min_rate, min_fare, effective_from)
VALUES (gen_random_uuid(), 'Kannur', 'AUTO', 35, 1.5, 16, 1.5, 35, '2026-05-01');
```
2. Or use the Fare Config tab in the admin console.

---

## 12. Sprint Roadmap Recommendation

### Sprint 1 (Week 1) — Production hardening
| Task | Effort | Priority |
|---|---|---|
| Fix Prisma migration file | 30 min | P1 |
| Rider ride history screen | 1 day | P2 |
| Sentry setup (server + both apps) | 0.5 day | P2 |
| Restrict CORS to heyauto.in | 30 min | Security |
| Encrypt Aadhaar at rest | 1 day | Security |
| Production deploy to EC2 + RDS + ElastiCache | 1 day | Infra |

### Sprint 2 (Week 2) — Revenue features
| Task | Effort | Priority |
|---|---|---|
| Razorpay in-app UPI payment | 2–3 days | Revenue |
| Driver earnings weekly chart | 1 day | UX |
| Surge pricing (admin-configurable multiplier) | 1 day | Revenue |
| Admin: payment status in ride history | 0.5 day | Ops |

### Sprint 3 (Week 3) — Engagement features
| Task | Effort | Priority |
|---|---|---|
| Scheduled rides | 2 days | Retention |
| In-app chat | 2 days | Safety/UX |
| Referral / promo codes | 2 days | Growth |

### Sprint 4 (Week 4) — Mobile app build & launch
| Task | Effort | Priority |
|---|---|---|
| Generate signing keystore (Android) | 0.5 day | Launch |
| Build release APK / AAB | 1 day | Launch |
| Build iOS IPA + App Store submission | 1 day | Launch |
| Play Store submission | 1 day | Launch |
| EAS Build config (`eas.json`) | 0.5 day | Launch |

---

## 13. Handover Checklist

### Code & Repository
- [ ] Developer has access to the Git repository
- [ ] Developer has read `TECHNICAL_DESIGN_DOCUMENT.md` (this repo's `/docs/` folder)
- [ ] Developer has run the project locally end-to-end (server + one app)

### Credentials & Secrets (share securely, NOT via email)
- [ ] Twilio Account SID + Auth Token + Phone Number
- [ ] Firebase service account JSON (for FCM)
- [ ] AWS IAM access key (S3 PutObject permission only)
- [ ] Razorpay Key ID + Key Secret + Webhook Secret
- [ ] Google Maps API key (Directions + Places + Geocoding enabled)
- [ ] JWT secrets (generate fresh: `openssl rand -hex 32`)
- [ ] Database credentials (prod)
- [ ] Sentry DSN

### Infrastructure
- [ ] Production server provisioned (EC2 t3.small or equivalent)
- [ ] PostgreSQL provisioned (RDS db.t3.micro)
- [ ] Redis provisioned (ElastiCache t3.micro or Redis Cloud free tier)
- [ ] S3 bucket `heyauto-uploads` created, region `ap-south-1`
- [ ] Domain `heyauto.in` pointed to server

### Mobile
- [ ] Android signing keystore generated and stored securely
- [ ] Apple Developer account enrolled (₹9,000/year) for iOS
- [ ] Google Play Console account created (one-time $25) for Android
- [ ] Bundle IDs confirmed: `in.heyauto.driver` + `in.heyauto.rider`
- [ ] `BASE_URL` in `apps/*/src/services/api.ts` updated to `https://api.heyauto.in/api/v1`
- [ ] Local machine LAN IP removed from dev URL

### Admin
- [ ] Admin phone number seeded in production DB
- [ ] Admin can log in at `https://heyauto.in/admin`
- [ ] Fare config for Taliparamba seeded

### Go-live smoke tests
- [ ] Rider can register, receive OTP, log in
- [ ] Driver can register, upload documents, subscribe
- [ ] Admin can verify driver documents + approve subscription
- [ ] Driver can go online
- [ ] Rider can request a ride, driver accepts, ride completes
- [ ] Push notification received by both rider and driver
- [ ] Admin dashboard shows correct live stats
