# Hey Auto — Technical Design Document (TDD)
**Version:** 1.0  
**Date:** 2026-04-27  
**Prepared for:** Developer Handover  
**Product:** Hey Auto — Zero-commission Auto-rickshaw Booking Platform  
**Region:** Taliparamba, Kannur District, Kerala (Phase 1)

---

## Table of Contents
1. [Product Overview](#1-product-overview)
2. [System Architecture](#2-system-architecture)
3. [Repository Structure](#3-repository-structure)
4. [Technology Stack](#4-technology-stack)
5. [Database Schema](#5-database-schema)
6. [Backend API Reference](#6-backend-api-reference)
7. [WebSocket Events](#7-websocket-events)
8. [Ride State Machine](#8-ride-state-machine)
9. [Driver Matching Algorithm](#9-driver-matching-algorithm)
10. [Fare Calculation Engine](#10-fare-calculation-engine)
11. [Subscription System](#11-subscription-system)
12. [Push Notifications](#12-push-notifications)
13. [Document Upload System](#13-document-upload-system)
14. [Mobile Apps — Screen Inventory](#14-mobile-apps--screen-inventory)
15. [Admin Console](#15-admin-console)
16. [Environment Variables](#16-environment-variables)
17. [Local Development Setup](#17-local-development-setup)
18. [Known Issues & Open Items](#18-known-issues--open-items)

---

## 1. Product Overview

Hey Auto is a mobile-first, zero-commission auto-rickshaw booking platform targeting small Kerala towns where Ola and Uber have no presence. Drivers keep 100% of all fares. Revenue is generated through optional daily driver subscriptions (₹25/day).

### Business Model
- **Driver pays:** ₹25/day subscription via UPI → submits UTR → admin approves → driver can go online
- **Rider pays:** Driver directly (cash / UPI to driver)
- **Commission:** Zero

### Phase 1 Scope
- City: Taliparamba, Kannur District
- Vehicle type: Auto-rickshaw (3-wheel), E-Auto
- Languages: Malayalam, English, Hindi

---

## 2. System Architecture

```
┌─────────────────────┐    ┌─────────────────────┐
│   Rider App         │    │   Driver App         │
│   (React Native)    │    │   (React Native)     │
│   iOS / Android     │    │   iOS / Android      │
└──────────┬──────────┘    └──────────┬───────────┘
           │  REST + WebSocket         │  REST + WebSocket
           ▼                          ▼
┌─────────────────────────────────────────────────┐
│              Node.js / Express Server            │
│              Port 3000 / /api/v1                 │
│                                                  │
│   ┌─────────┐  ┌──────────┐  ┌───────────────┐  │
│   │  Auth   │  │  Rides   │  │  Driver/Rider │  │
│   │ Module  │  │  Module  │  │  Modules      │  │
│   └─────────┘  └──────────┘  └───────────────┘  │
│   ┌─────────┐  ┌──────────┐  ┌───────────────┐  │
│   │  Admin  │  │  Payment │  │  Notification │  │
│   │ Module  │  │  Module  │  │  Module       │  │
│   └─────────┘  └──────────┘  └───────────────┘  │
│                                                  │
│   Socket.io server (ride events via Redis pub/sub)│
└──────────────────────────────────────────────────┘
           │                          │
    ┌──────▼──────┐            ┌──────▼──────┐
    │ PostgreSQL  │            │    Redis     │
    │ (Prisma ORM)│            │ (pub/sub +  │
    │             │            │  sessions)  │
    └─────────────┘            └─────────────┘
           │
    ┌──────▼──────┐    ┌──────────────┐    ┌────────────┐
    │   AWS S3    │    │   Firebase   │    │  Twilio    │
    │ (doc uploads│    │   (FCM push) │    │  (OTP SMS) │
    │  - optional)│    │   - optional │    │  - optional│
    └─────────────┘    └──────────────┘    └────────────┘
```

### Key Design Decisions
- **Redis pub/sub for ride events:** The ride service publishes to a `ride_events` channel; Socket.io handler subscribes and fans out to the correct user socket. This decouples ride business logic from WebSocket delivery.
- **Haversine fallback:** If Google Maps API key is not configured, distance/duration is estimated using haversine formula.
- **Optional cloud services:** All third-party integrations (S3, Firebase, Twilio, Sentry) degrade gracefully when credentials are missing. The app works end-to-end without any of them (dev/staging mode).

---

## 3. Repository Structure

```
Hey Auto/                          ← monorepo root
├── package.json                   ← Turborepo + npm workspaces root
├── turbo.json
├── apps/
│   ├── driver-app/                ← Driver React Native app
│   │   ├── src/
│   │   │   ├── features/          ← Feature screens
│   │   │   │   ├── auth/          ← OTP login, registration
│   │   │   │   ├── home/          ← Online/offline toggle, map
│   │   │   │   ├── ride/          ← Active ride, navigation
│   │   │   │   ├── profile/       ← Profile, documents, vehicle
│   │   │   │   ├── earnings/      ← Earnings summary
│   │   │   │   └── history/       ← Ride history
│   │   │   ├── services/          ← API client (axios), driver service
│   │   │   ├── store/             ← Zustand state stores
│   │   │   ├── components/        ← Shared UI components
│   │   │   ├── navigation/        ← React Navigation stacks
│   │   │   ├── theme/             ← Colors, typography, spacing
│   │   │   └── utils/             ← Helpers, storage (MMKV)
│   │   ├── HeyAutoDriver/         ← Bare native project (android/ + ios/)
│   │   └── app.json
│   │
│   ├── rider-app/                 ← Rider React Native app
│   │   ├── src/
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   ├── home/          ← Map, address search, ride request
│   │   │   │   ├── booking/       ← Fare estimate, confirm ride
│   │   │   │   ├── ride/          ← Active ride, OTP, driver tracking
│   │   │   │   ├── profile/       ← Profile, saved places, emergency contacts
│   │   │   │   └── history/       ← Ride history
│   │   │   └── ...               ← Same structure as driver-app
│   │   └── app.json
│   │
│   └── demo-dashboard/
│       └── admin.html             ← Vanilla HTML/JS admin console (no build step)
│
└── server/                        ← Node.js backend
    ├── src/
    │   ├── app.ts                 ← Express app + Socket.io setup
    │   ├── config/
    │   │   ├── env.ts             ← Zod-validated env schema
    │   │   ├── database.ts        ← Prisma client singleton
    │   │   └── redis.ts           ← Redis + Redis pub/sub clients
    │   ├── middleware/
    │   │   ├── auth.ts            ← JWT verify + socket auth
    │   │   ├── validate.ts        ← Zod request validation
    │   │   └── errorHandler.ts    ← Global error handler
    │   ├── modules/
    │   │   ├── auth/              ← OTP send/verify, refresh token
    │   │   ├── rider/             ← Profile, saved places, SOS
    │   │   ├── driver/            ← Profile, vehicle, documents, location
    │   │   ├── ride/              ← Estimate, request, lifecycle, rating
    │   │   ├── payment/           ← Subscription, UTR verify
    │   │   ├── admin/             ← Dashboard, driver/rider/doc mgmt
    │   │   ├── notification/      ← FCM push + DB notification log
    │   │   ├── maps/              ← Google Maps proxy
    │   │   └── whatsapp/          ← WhatsApp event listener (scaffolded)
    │   ├── services/
    │   │   ├── maps.ts            ← Google Maps / haversine fallback
    │   │   └── upload.ts          ← multer + S3 / local file upload
    │   ├── socket/
    │   │   └── handler.ts         ← Socket.io + Redis pub/sub bridge
    │   └── utils/
    │       ├── helpers.ts         ← Haversine, OTP generator, fare rounding
    │       ├── errors.ts          ← Custom error classes
    │       └── logger.ts          ← Pino logger
    └── prisma/
        ├── schema.prisma
        └── migrations/
```

---

## 4. Technology Stack

### Backend
| Component | Technology | Version |
|---|---|---|
| Runtime | Node.js | 20.x LTS |
| Framework | Express | 4.x |
| Language | TypeScript | 5.7 |
| ORM | Prisma | 6.3 |
| Database | PostgreSQL | 15+ |
| Cache / PubSub | Redis (ioredis) | 5.x |
| WebSockets | Socket.io | 4.8 |
| Auth | JWT (jsonwebtoken) | 9.x |
| Validation | Zod | 3.x |
| OTP / SMS | Twilio | 5.x |
| Payment | Razorpay SDK | 2.x |
| Push Notifications | Firebase Admin SDK | (dynamic import) |
| File Upload | multer + @aws-sdk/client-s3 | 1.x / 3.x |
| Logging | Pino | 9.x |
| Process runner (dev) | tsx watch | 4.x |

### Mobile Apps (both driver + rider)
| Component | Technology |
|---|---|
| Framework | React Native 0.81 + Expo SDK 54 |
| Language | TypeScript |
| Navigation | React Navigation v6 |
| State management | Zustand |
| HTTP client | Axios |
| WebSockets | socket.io-client |
| Maps | react-native-maps |
| Location | expo-location |
| Storage | react-native-mmkv |
| Image picker | expo-image-picker |
| Push tokens | expo-notifications |
| Internationalisation | react-i18next |
| Icons | @expo/vector-icons (MaterialCommunityIcons) |

### Infrastructure (optional — see env vars)
| Service | Purpose |
|---|---|
| AWS S3 | Document image storage |
| Firebase FCM | Push notifications |
| Twilio | OTP SMS delivery |
| Razorpay | In-app UPI payments |
| Google Maps Platform | Route, distance, geocoding |
| Sentry | Error monitoring |

---

## 5. Database Schema

### Core Models

#### `users`
Primary identity table. One row per user regardless of role.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| phone | VARCHAR(15) UNIQUE | Login identifier |
| email | VARCHAR(255) | Optional |
| full_name | VARCHAR(100) | |
| language | VARCHAR(5) | `ml`, `en`, `hi` |
| role | UserRole | `RIDER`, `DRIVER`, `ADMIN` |
| status | UserStatus | `ACTIVE`, `SUSPENDED`, `DEACTIVATED`, `PENDING_VERIFICATION` |
| fcm_token | TEXT | Updated on every login |
| created_at / updated_at | TIMESTAMPTZ | |

#### `driver_profiles`
Extended profile for drivers only. 1:1 with `users`.

| Column | Type | Notes |
|---|---|---|
| is_online | BOOLEAN | Toggled by driver |
| is_on_ride | BOOLEAN | Set by ride service |
| current_lat / current_lng | FLOAT | Updated every 3 sec via socket |
| verification_status | VerificationStatus | `PENDING`, `IN_REVIEW`, `VERIFIED`, `REJECTED` |
| acceptance_rate | FLOAT | Updated after each request timeout |
| city | VARCHAR(50) | Used for fare config lookup |

Index: `(is_online, is_on_ride, city)` — used by driver matching query.

#### `rides`
Central ride table tracking the full lifecycle.

| Column | Type | Notes |
|---|---|---|
| status | RideStatus | See state machine section |
| ride_otp | VARCHAR(4) | Generated at request time, verified before trip start |
| estimated_fare | FLOAT | Calculated at request time |
| actual_fare / total_amount | FLOAT | Set at completion |
| night_surcharge | FLOAT | 0 when not applicable |
| tip_amount | FLOAT | Added by rider at completion |
| payment_method | PaymentMethod | `CASH`, `UPI`, `WALLET`, `CARD` |
| payment_status | PaymentStatus | `PENDING` → `COMPLETED` |

Indexes: `(rider_id, status)`, `(driver_id, status)`, `(status, city)`, `(created_at DESC)`.

#### `driver_subscriptions`
Tracks a driver's subscription purchase. One active subscription at a time.

| Column | Type | Notes |
|---|---|---|
| status | SubscriptionStatus | `PENDING` → `ACTIVE` (admin approves) or `EXPIRED` |
| expires_at | TIMESTAMPTZ | `starts_at + plan.duration_days` |

#### `driver_documents`
One row per document type per driver.

| Column | Type | Notes |
|---|---|---|
| doc_type | DocumentType | `DRIVING_LICENSE`, `VEHICLE_RC`, `INSURANCE`, `PERMIT`, `AADHAAR`, `PHOTO`, `VEHICLE_PHOTO` |
| doc_url | TEXT | S3 URL or `/uploads/filename` for local dev |
| status | DocumentStatus | `PENDING` → `VERIFIED` / `REJECTED` |
| rejection_reason | TEXT | Shown to driver in app |

#### `fare_configs`
Admin-configurable per-city fare parameters.

| Column | Default | Notes |
|---|---|---|
| base_fare | ₹30 | Flat charge for first 1.5 km |
| base_distance_km | 1.5 | Distance covered by base fare |
| per_km_rate | ₹15 | Per km after base distance |
| per_min_rate | ₹1.5 | Per minute of ride time |
| min_fare | ₹30 | Floor |
| night_multiplier | 1.25 | Applied 10 PM – 5 AM |

---

## 6. Backend API Reference

**Base URL:** `http://localhost:3000/api/v1`  
**Auth header:** `Authorization: Bearer <accessToken>`

### Auth (`/auth`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/send-otp` | None | Send OTP to phone via Twilio. Falls back to console log if Twilio not configured. |
| POST | `/auth/verify-otp` | None | Verify OTP → returns `{ accessToken, refreshToken, user }` |
| POST | `/auth/refresh-token` | None | Exchange refresh token for new access token |
| POST | `/auth/logout` | JWT | Invalidate refresh token |

### Rider (`/rider`)
| Method | Path | Description |
|---|---|---|
| GET | `/rider/profile` | Get rider profile |
| PUT | `/rider/profile` | Update name, email, language |
| GET | `/rider/saved-places` | List saved places |
| POST | `/rider/saved-places` | Add saved place |
| DELETE | `/rider/saved-places/:id` | Remove saved place |
| GET | `/rider/emergency-contacts` | List emergency contacts |
| POST | `/rider/emergency-contacts` | Add contact |
| DELETE | `/rider/emergency-contacts/:id` | Remove contact |
| POST | `/rider/sos` | Trigger SOS — logs safety notification + pushes rider |

### Driver (`/driver`)
| Method | Path | Description |
|---|---|---|
| GET | `/driver/profile` | Get full driver profile with vehicle + subscription |
| PUT | `/driver/profile` | Update name, email, city, language |
| POST | `/driver/vehicle` | Register vehicle |
| PUT | `/driver/vehicle/:id` | Update vehicle details |
| POST | `/driver/documents` | Upload document (multipart/form-data, field: `file`) |
| GET | `/driver/documents` | List all documents with status |
| POST | `/driver/go-online` | Set driver online + update location |
| POST | `/driver/go-offline` | Set driver offline |
| PUT | `/driver/location` | Update GPS location |
| GET | `/driver/earnings` | Earnings summary (today / week / month / total) |
| GET | `/driver/rides/history` | Paginated ride history |

### Rides (`/rides`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/rides/estimate` | RIDER | Get fare estimate + route polyline |
| POST | `/rides/request` | RIDER | Create ride request → triggers matching |
| POST | `/rides/:id/accept` | DRIVER | Accept ride request |
| POST | `/rides/:id/arrived` | DRIVER | Mark arrived at pickup |
| POST | `/rides/:id/start` | DRIVER | Verify OTP + start ride |
| POST | `/rides/:id/complete` | DRIVER | Complete ride + calculate actual fare |
| POST | `/rides/:id/cancel` | RIDER/DRIVER | Cancel with optional reason |
| POST | `/rides/:id/rate` | RIDER/DRIVER | Rate the other party (1–5 stars + optional tip) |
| GET | `/rides/:id` | RIDER/DRIVER | Get ride details |

### Subscription (`/subscription`)
| Method | Path | Description |
|---|---|---|
| GET | `/subscription/status` | Current subscription status for logged-in driver |
| GET | `/subscription/plans` | Available plans |
| POST | `/subscription/verify-utr` | Submit UPI UTR number → creates PENDING subscription |

### Notification (`/notifications`)
| Method | Path | Description |
|---|---|---|
| PUT | `/notifications/fcm-token` | Register/update Expo push token |
| GET | `/notifications` | List notifications for user |
| PUT | `/notifications/:id/read` | Mark notification as read |

### Admin (`/admin`) — ADMIN role only
| Method | Path | Description |
|---|---|---|
| GET | `/admin/dashboard` | Aggregate stats |
| GET | `/admin/drivers` | Paginated driver list with filters |
| GET | `/admin/drivers/:id` | Driver detail |
| PUT | `/admin/drivers/:id/verify` | Approve / reject driver `{ action: 'APPROVE' \| 'REJECT' }` |
| GET | `/admin/riders` | Paginated rider list |
| GET | `/admin/documents` | All pending documents |
| PUT | `/admin/documents/:id/verify` | Approve / reject document |
| GET | `/admin/subscriptions` | Subscription list (filter: PENDING / ALL) |
| PUT | `/admin/subscriptions/:id/approve` | Approve subscription → driver goes ACTIVE |
| PUT | `/admin/subscriptions/:id/reject` | Reject subscription |
| GET | `/admin/rides` | Ride history with filters |
| GET | `/admin/fare-config` | Current fare config |
| PUT | `/admin/fare-config` | Update fare config |

---

## 7. WebSocket Events

**Connection:** `io(SERVER_URL, { auth: { token: accessToken } })`

### Client → Server (emit)
| Event | Payload | Who emits |
|---|---|---|
| `driver:location_update` | `{ lat, lng }` | Driver (every 3 sec when online) |
| `rider:nearby_drivers` | `{ lat, lng }` | Rider (on map open) |

### Server → Client (receive)
| Event | Payload | Who receives |
|---|---|---|
| `nearby_drivers` | `[{ lat, lng, distance }]` | Rider |
| `ride:new_request` | `{ rideId, pickupLat, pickupLng, pickupAddress, dropoffAddress, estimatedFare, distance, riderName, riderPhone, timeoutSec: 15 }` | Driver |
| `ride:driver_assigned` | `{ rideId, driverId, driverName, driverPhone, driverRating, vehicleRegistrationNo, vehicleColor, vehicleModel, driverLat, driverLng }` | Rider |
| `ride:driver_location` | `{ rideId, lat, lng }` | Rider (during ride) |
| `ride:driver_arrived` | `{ rideId, rideOtp }` | Rider |
| `ride:started` | `{ rideId }` | Rider |
| `ride:completed` | `{ rideId, actualFare, totalAmount, actualDistanceKm, actualDurationMin, paymentMethod }` | Rider + Driver |
| `ride:cancelled` | `{ rideId, cancelledBy, reason? }` | Rider and/or Driver |
| `ride:no_drivers` | `{ rideId }` | Rider |

---

## 8. Ride State Machine

```
REQUESTED
    │
    ├──[No driver accepts in 15s × 3 rounds]──→ NO_DRIVERS
    │
    ▼
DRIVER_ASSIGNED  ←──[Driver accepts]
    │
    ▼
DRIVER_ARRIVED   ←──[Driver marks arrived]
    │
    ▼
OTP_VERIFIED     ←──[Driver enters OTP from rider]
    │
    ▼
IN_PROGRESS      ←──[Trip started]
    │
    ▼
COMPLETED        ←──[Driver marks complete]
    │
    ▼
[Rating window]

At any point before IN_PROGRESS:
    ├── CANCELLED_RIDER  (rider cancels)
    └── CANCELLED_DRIVER (driver cancels)
```

**OTP flow:**
- 4-digit OTP generated at ride request time, stored in `rides.ride_otp`
- Sent to rider via socket `ride:driver_arrived` event
- Driver types OTP displayed on rider's screen before trip starts

---

## 9. Driver Matching Algorithm

Triggered by `POST /rides/request`. The matching runs up to `MAX_MATCHING_ROUNDS` (default: 3) with a `RIDE_REQUEST_TIMEOUT_SEC` (default: 15s) per round.

```
Round 1: Query drivers where:
  - is_online = true
  - is_on_ride = false
  - city = ride.city
  - verification_status = VERIFIED
  - active subscription (expires_at > now)
  - within DRIVER_SEARCH_RADIUS_KM (default: 3 km) haversine distance

For each candidate, compute score:
  score = (1 / distance_km) × rating × acceptance_rate

Pick top N candidates (N = available drivers).
Send ride:new_request to each driver socket via Redis pub/sub.
Wait 15 seconds.

If accepted → assign, emit ride:driver_assigned to rider.
If none accept → repeat with slightly larger radius.
After MAX_MATCHING_ROUNDS with no acceptance → emit ride:no_drivers to rider.
```

**Active ride tracking:** When a driver accepts, the active ride ID is cached in Redis (`active_ride:<driverId>`) for fast lookups during location streaming.

---

## 10. Fare Calculation Engine

`GET /rides/estimate` and called again internally at ride request.

```
1. Get route from Google Maps (or haversine if no API key)
   → distanceKm, durationMin, polyline, steps

2. Look up fare_configs WHERE city = city AND is_active = true
   ORDER BY effective_from DESC LIMIT 1

3. Calculate:
   fare = baseFare
   if distanceKm > baseDistanceKm:
     fare += (distanceKm - baseDistanceKm) × perKmRate
   fare += durationMin × perMinRate

4. Night surcharge (10 PM – 5 AM):
   nightSurcharge = fare × (nightMultiplier - 1)
   fare = fare × nightMultiplier

5. fare = max(fare, minFare)

6. Round all values to nearest rupee

Response includes itemized breakdown:
  { baseFare, distanceFare, timeFare, nightSurcharge, totalFare,
    distanceKm, durationMin, polyline, steps }
```

Default rates (Taliparamba): Base ₹30 / 1.5 km, ₹15/km, ₹1.5/min, min ₹30, night 1.25×.

---

## 11. Subscription System

### Flow
```
Driver → GET /subscription/plans
       → Shows UPI QR / deep link to pay ₹25 to Hey Auto UPI
       → Driver completes payment in UPI app
       → Returns to app, enters 12-digit UTR number
       → POST /subscription/verify-utr { utrNumber }
       → Server creates DriverSubscription { status: PENDING }
       → Admin sees it in Subscriptions tab
       → Admin verifies bank statement, clicks Approve
       → PUT /admin/subscriptions/:id/approve
       → status → ACTIVE, expires_at = now + plan.duration_days
       → Push notification sent to driver
       → Driver's go-online button now works
```

### Subscription gate on go-online
`POST /driver/go-online` checks:
1. Driver verification_status === VERIFIED
2. Active subscription exists (status: ACTIVE, expires_at > now)
3. Returns `SUBSCRIPTION_REQUIRED` error if not subscribed → app shows "Subscribe Now" alert

---

## 12. Push Notifications

Push is sent at 6 ride lifecycle events:

| Event | Recipient | Title |
|---|---|---|
| New ride request | Driver | "New Ride Request" |
| Driver assigned | Rider | "Driver Found!" |
| Driver arrived | Rider | "Driver Arrived" |
| Ride completed | Rider + Driver | "Ride Completed" |
| Ride cancelled | Other party | "Ride Cancelled" |
| No drivers available | Rider | "No Drivers" |

Additional:
- Subscription approved/rejected → Driver
- Document verified/rejected → Driver
- SOS triggered → Rider

### Implementation
1. On login, app calls `PUT /notifications/fcm-token` with Expo push token
2. Server stores in `users.fcm_token`
3. `NotificationService.sendPushNotification()` — loads `firebase-admin` dynamically, degrades gracefully if `FIREBASE_PROJECT_ID` not set
4. All push calls use `.catch(() => {})` — push failures never break ride flow

---

## 13. Document Upload System

### Flow (updated)
1. Driver picks image via camera or gallery (`expo-image-picker`)
2. App builds `FormData` with field `file` (image) + field `docType`
3. `POST /driver/documents` with `Content-Type: multipart/form-data`
4. Server: `multer.single('file')` reads buffer (5 MB limit, images only)
5. `uploadFileToStorage()` in `server/src/services/upload.ts`:
   - **If S3 configured** (AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_S3_BUCKET set): uploads to S3, returns `https://<bucket>.s3.<region>.amazonaws.com/documents/<timestamp>-<random>.<ext>`
   - **If S3 not configured** (local/dev): saves to `server/uploads/`, returns `/uploads/<filename>` (served statically)
6. URL stored in `driver_documents.doc_url`
7. Admin dashboard image lightbox loads the URL — works in both modes

### S3 bucket setup
- Bucket name: `heyauto-uploads` (configurable via `AWS_S3_BUCKET`)
- Region: `ap-south-1` (configurable via `AWS_REGION`)
- Objects are public-read (admin dashboard loads them directly)
- Folder structure: `documents/<filename>`

---

## 14. Mobile Apps — Screen Inventory

### Driver App (`apps/driver-app`)

| Screen | File | Description |
|---|---|---|
| OTP Login | `auth/LoginScreen.tsx` | Phone entry + OTP verify |
| Registration | `auth/RegisterScreen.tsx` | Name, language selection |
| Home | `home/HomeScreen.tsx` | Map, online/offline toggle, earnings summary |
| Active Ride | `ride/ActiveRideScreen.tsx` | Navigation banner, call rider, OTP entry, rate rider |
| Documents | `profile/DocumentsScreen.tsx` | Upload + status for 7 document types |
| Profile | `profile/ProfileScreen.tsx` | Edit profile details |
| Vehicle | `profile/VehicleScreen.tsx` | Vehicle registration details |
| Subscription | `profile/SubscriptionScreen.tsx` | Plans → UPI QR → UTR entry |
| Earnings | `earnings/EarningsScreen.tsx` | Daily/weekly/monthly/total |
| Ride History | `history/HistoryScreen.tsx` | Past rides list |

### Rider App (`apps/rider-app`)

| Screen | File | Description |
|---|---|---|
| OTP Login | `auth/LoginScreen.tsx` | Phone entry + OTP verify |
| Home | `home/HomeScreen.tsx` | Map, pickup/drop address search, nearby drivers |
| Booking | `booking/BookingScreen.tsx` | Fare estimate, confirm ride |
| Active Ride | `ride/ActiveRideScreen.tsx` | Driver location on map, OTP card, SOS button |
| Ride Complete | `ride/RideCompleteScreen.tsx` | Itemized receipt, tip, rating |
| Profile | `profile/ProfileScreen.tsx` | Edit profile |
| Saved Places | `profile/SavedPlacesScreen.tsx` | Home, work, custom places |
| Emergency Contacts | `profile/EmergencyContactsScreen.tsx` | SOS contact list |
| Ride History | `history/HistoryScreen.tsx` | Past rides |

### Theme
- Primary: `#F5C800` (yellow)
- Background: `#1A1A2E` (dark navy)
- All screens use `ScreenWrapper` component for consistent safe-area handling

---

## 15. Admin Console

**File:** `apps/demo-dashboard/admin.html`  
**Access:** `http://localhost:3000/admin`  
**No build step** — vanilla HTML + JavaScript served statically.

| Tab | Features |
|---|---|
| Dashboard | Live stats: total riders, drivers online/verified/pending, rides today, revenue |
| Drivers | List/search/filter by city/status, add driver modal, verify/reject, document checklist popup |
| Riders | List/search, status, rating, total rides |
| Documents | Image preview lightbox, filter by status, verify/reject individual documents |
| Subscriptions | Pending tab + All tab, approve/reject UTR submissions |
| Ride History | Filter by status, date range |
| Fare Config | Edit base fare, per-km, per-min, night multiplier per city |

Admin login uses the same JWT auth as the API. The admin user is seeded via `prisma/seed.ts`.

---

## 16. Environment Variables

Create `server/.env` from this template:

```env
# Core
NODE_ENV=development
PORT=3000
API_VERSION=v1

# Database
DATABASE_URL=postgresql://heyauto:heyauto_dev_2024@localhost:5432/heyauto?schema=public
REDIS_URL=redis://localhost:6379

# JWT — generate with: openssl rand -hex 32
JWT_ACCESS_SECRET=<32-char-random>
JWT_REFRESH_SECRET=<32-char-random>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d

# OTP (Twilio) — optional, falls back to console.log in dev
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Maps — optional, falls back to haversine distance estimate
GOOGLE_MAPS_API_KEY=

# AWS S3 — optional, falls back to local uploads/ folder
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
AWS_S3_BUCKET=heyauto-uploads

# Firebase FCM — optional, skips push if not set
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=

# Razorpay — optional
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# Sentry — optional
SENTRY_DSN=

# WhatsApp Business API — optional
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_API_VERSION=v19.0

# Ride matching config
DRIVER_SEARCH_RADIUS_KM=3
RIDE_REQUEST_TIMEOUT_SEC=15
MAX_MATCHING_ROUNDS=3
OTP_EXPIRY_SEC=300
```

### Mobile App Base URL
In `apps/driver-app/src/services/api.ts` and `apps/rider-app/src/services/api.ts`:
```ts
const BASE_URL = __DEV__ ? 'http://192.168.1.3:3000/api/v1' : 'https://api.heyauto.in/api/v1';
```
Replace `192.168.1.3` with your local machine's LAN IP when testing on a physical device.

---

## 17. Local Development Setup

### Prerequisites
- Node.js 20 LTS
- Docker Desktop (for Postgres + Redis)
- npm 10+

### Steps

```bash
# 1. Clone and install
git clone <repo>
cd "Hey Auto"
npm install          # installs all workspaces

# 2. Start Postgres + Redis
npm run docker:up    # runs docker-compose up -d

# 3. Create server/.env (copy from section 16)

# 4. Run migrations + seed
npm run db:migrate   # prisma migrate dev
npm run db:seed      # creates admin user + fare config

# 5. Start the backend
npm run dev:server   # tsx watch src/app.ts on port 3000

# 6. Start a mobile app (in a new terminal)
cd apps/driver-app
npm run start        # Expo dev server
# or:
npm run android      # expo run:android (needs Android Studio)
npm run ios          # expo run:ios (needs Xcode on Mac)
```

### Useful Scripts (from repo root)
| Script | What it does |
|---|---|
| `npm run docker:up` | Start PostgreSQL + Redis containers |
| `npm run docker:down` | Stop containers |
| `npm run dev:server` | Start backend in watch mode |
| `npm run db:migrate` | Run pending Prisma migrations |
| `npm run db:studio` | Open Prisma Studio (DB browser) |
| `npm run db:seed` | Seed admin user + fare configs |

---

## 18. Known Issues & Open Items

### P1 — Must fix
| # | Issue | File | Fix |
|---|---|---|---|
| 1 | Prisma migration file incomplete | `server/prisma/migrations/20260426161108_add_subscription_pending_status/migration.sql` | Add `ALTER TABLE driver_subscriptions ALTER COLUMN status SET DEFAULT 'PENDING';` — DB already correct, migration file just needs the line for `prisma migrate reset` to replay cleanly |

### P2 — Should build
| # | Feature | Notes |
|---|---|---|
| 2 | Razorpay in-app payment | SDK installed, keys in `.env`. Implement `POST /payments/create-order` + webhook handler. Replace cash-only flow with UPI checkout in rider app. |
| 3 | Ride history screen (rider app) | Backend endpoint exists. Build `HistoryScreen.tsx` in rider app. |
| 4 | Earnings chart (driver app) | Backend endpoint exists. Add weekly bar chart to `EarningsScreen.tsx`. |
| 5 | Surge pricing | Add time-based or demand-based multiplier to fare config. Already has `night_multiplier` pattern to follow. |

### P3 — Nice to have
| # | Feature | Notes |
|---|---|---|
| 6 | Sentry error monitoring | `SENTRY_DSN` already in env schema. Install `@sentry/react-native` in both apps and `@sentry/node` in server. |
| 7 | WhatsApp booking | `whatsapp` module is scaffolded. Wire up Beckn-style ride booking via WhatsApp Business API. |
| 8 | In-app chat | Socket.io already running. Add `chat:message` events + a chat UI screen in both apps. |
| 9 | Referral / promo codes | New `PromoCode` model + redemption logic at ride request. |
| 10 | Scheduled rides | Add `scheduledAt` field to ride request. Cron job to dispatch matching at the right time. |
