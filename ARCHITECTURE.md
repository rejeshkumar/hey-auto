# Hey Auto - Complete System Architecture

## 1. Product Vision

**Hey Auto** is a zero-commission, driver-first auto-rickshaw booking platform for Kerala. It connects riders directly with auto-rickshaw drivers through a transparent, fair-pricing model — built by Kerala, for Kerala.

### Core Principles

- **Zero Commission**: Drivers keep 100% of fares. Revenue comes from optional driver subscriptions.
- **Malayalam-First**: Native Malayalam interface with English/Hindi for tourists.
- **Transparent Pricing**: Government meter rates as baseline. No surge pricing.
- **Driver Welfare**: Built-in welfare fund, insurance support, and training resources.
- **Open Mobility**: Built on open standards, enabling future integration with KSRTC buses and Kochi Metro.

### Target Markets (Phased Rollout)

| Phase | Cities | Timeline |
|-------|--------|----------|
| Phase 1 (MVP) | **Taliparamba, Kannur District** | Month 1-3 |
| Phase 2 | Kannur city, Payyanur, Iritty | Month 4-6 |
| Phase 3 | Calicut, Thalassery, Kasaragod | Month 7-9 |
| Phase 4 | Kochi, Thrissur, Thiruvananthapuram | Month 10-12 |
| Phase 5 | All Kerala districts + Tourism circuits | Month 13-18 |

### Why Taliparamba First?

- **Small town advantage**: ~1 lakh population, 18.96 sq km — entire town coverable by autos
- **Manageable driver pool**: Estimated 500-800 auto drivers — can onboard personally
- **No competition**: No Ola/Uber/Kerala Savari presence in small towns
- **High auto dependency**: No metro, limited bus routes — autos are primary last-mile transport
- **Word of mouth**: Small town = news spreads fast, organic growth
- **Low cost to test**: Fewer rides = lower server/maps costs during testing
- **Key routes to serve**: Bus Stand ↔ Town, Kannapuram Railway Station (10km), Temples, Schools, Hospital
- **Proof of concept**: Success here proves the model works for 100+ similar Kerala towns

---

## 2. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT APPLICATIONS                          │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Rider App   │  │  Driver App  │  │     Admin Dashboard      │  │
│  │ (React Native│  │(React Native │  │   (React + TypeScript)   │  │
│  │  iOS/Android)│  │  iOS/Android)│  │                          │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│         │                 │                        │                │
└─────────┼─────────────────┼────────────────────────┼────────────────┘
          │                 │                        │
          ▼                 ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY (Kong)                          │
│            Rate Limiting · Auth · Load Balancing · Logging          │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────────┐
          ▼                   ▼                        ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐
│   Auth Service  │ │  Ride Service   │ │   Location Service      │
│   (Node.js)     │ │  (Node.js)      │ │   (Node.js + Redis)     │
│                 │ │                  │ │                         │
│ • OTP/SMS Auth  │ │ • Ride Lifecycle│ │ • Real-time GPS         │
│ • JWT Tokens    │ │ • Fare Calc     │ │ • Driver Tracking       │
│ • User Profiles │ │ • Matching      │ │ • Geofencing            │
│ • KYC/Docs      │ │ • Cancellation  │ │ • ETA Calculation       │
└────────┬────────┘ └────────┬────────┘ └───────────┬─────────────┘
         │                   │                       │
         ▼                   ▼                       ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐
│Payment Service  │ │ Notification    │ │   Analytics Service     │
│  (Node.js)      │ │  Service        │ │   (Node.js)             │
│                 │ │  (Node.js)      │ │                         │
│ • Razorpay UPI  │ │ • Push (FCM)    │ │ • Ride Analytics        │
│ • Wallet        │ │ • SMS (Twilio)  │ │ • Driver Performance    │
│ • Fare Split    │ │ • In-App        │ │ • Revenue Tracking      │
│ • Refunds       │ │ • Email         │ │ • Heat Maps             │
└────────┬────────┘ └────────┬────────┘ └───────────┬─────────────┘
         │                   │                       │
         └───────────────────┼───────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                   │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  PostgreSQL   │  │    Redis     │  │      AWS S3              │  │
│  │  + PostGIS    │  │              │  │                          │  │
│  │              │  │ • Sessions    │  │ • Profile Photos         │  │
│  │ • Users      │  │ • Driver Loc  │  │ • KYC Documents          │  │
│  │ • Rides      │  │ • Ride Cache  │  │ • Receipts               │  │
│  │ • Payments   │  │ • Rate Limits │  │ • App Assets             │  │
│  │ • Vehicles   │  │ • Pub/Sub     │  │                          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### 3.1 Mobile Apps (Rider + Driver)

| Component | Technology | Justification |
|-----------|-----------|---------------|
| Framework | React Native 0.76+ | Single codebase for iOS/Android, large ecosystem |
| Language | TypeScript | Type safety, better DX, fewer runtime errors |
| Navigation | React Navigation 7 | Type-safe, deep linking, tab/stack patterns |
| State (Server) | TanStack Query v5 | Caching, background sync, optimistic updates |
| State (Client) | Zustand | Lightweight, no boilerplate, great with TypeScript |
| Maps | react-native-maps + Google Maps SDK | Industry standard, reliable in India |
| Real-time | Socket.io Client | Bi-directional real-time communication |
| Local Storage | MMKV | 30x faster than AsyncStorage |
| Forms | React Hook Form + Zod | Performant validation |
| Animations | Reanimated 3 | 60fps native animations for ride tracking |
| Push Notifications | Firebase Cloud Messaging | Reliable, free tier sufficient for MVP |
| Payments | Razorpay React Native SDK | Best UPI support in India |
| i18n | react-i18next | Malayalam, English, Hindi support |
| Location | react-native-geolocation-service | Background location tracking |

### 3.2 Backend Services

| Component | Technology | Justification |
|-----------|-----------|---------------|
| Runtime | Node.js 20 LTS | Non-blocking I/O, great for real-time apps |
| Framework | Express.js + TypeScript | Mature, extensive middleware ecosystem |
| API Style | REST + WebSocket (Socket.io) | REST for CRUD, WebSocket for real-time |
| Validation | Zod | Runtime type validation matching frontend |
| ORM | Prisma | Type-safe database access, migrations |
| Auth | JWT + Redis sessions | Stateless auth with revocation capability |
| SMS/OTP | Twilio / MSG91 | OTP verification, ride alerts |
| Payments | Razorpay Node SDK | UPI, cards, wallets, auto-debit |
| File Upload | Multer + AWS S3 | Scalable document/photo storage |
| Logging | Pino | High-performance structured logging |
| Rate Limiting | express-rate-limit + Redis | DDoS protection, API abuse prevention |
| Testing | Jest + Supertest | Unit + integration testing |

### 3.3 Infrastructure

| Component | Technology | Justification |
|-----------|-----------|---------------|
| Database | PostgreSQL 16 + PostGIS | Relational data + geospatial queries |
| Cache/Realtime | Redis 7 | Driver locations, sessions, pub/sub |
| Object Storage | AWS S3 | KYC docs, photos, receipts |
| Hosting | AWS (EC2/ECS) or Railway | Scalable, India region available |
| CDN | CloudFront | Fast asset delivery across Kerala |
| CI/CD | GitHub Actions | Automated testing, builds, deployment |
| Monitoring | Sentry + Prometheus + Grafana | Error tracking + metrics + dashboards |
| Containerization | Docker + Docker Compose | Consistent dev/prod environments |
| API Gateway | Kong (or Nginx) | Rate limiting, auth, routing |
| DNS/SSL | Cloudflare | DDoS protection, free SSL, fast DNS |

---

## 4. Application Architecture

### 4.1 Rider App Screens

```
├── Onboarding
│   ├── Welcome Screen (language selection: Malayalam/English/Hindi)
│   ├── Phone Number Input
│   ├── OTP Verification
│   └── Profile Setup (name, email, emergency contact)
│
├── Home (Map View)
│   ├── Current Location Pin
│   ├── "Where to?" Search Bar
│   ├── Saved Places (Home, Work, Custom)
│   ├── Recent Rides Quick Access
│   └── Nearby Drivers Animation
│
├── Booking Flow
│   ├── Pickup Location (auto-detected or manual)
│   ├── Drop Location (search with autocomplete)
│   ├── Route Preview on Map
│   ├── Fare Estimate (meter rate breakdown)
│   ├── Payment Method Selection
│   └── Confirm Booking
│
├── Ride In-Progress
│   ├── Driver Details (name, photo, vehicle number, rating)
│   ├── Live Map Tracking
│   ├── ETA Display
│   ├── Call/Chat with Driver
│   ├── Share Ride (safety)
│   ├── SOS Emergency Button
│   └── Cancel Ride
│
├── Ride Complete
│   ├── Fare Breakdown
│   ├── Payment Confirmation
│   ├── Rate Driver (1-5 stars)
│   ├── Tip Driver (optional)
│   └── Download Receipt
│
├── My Rides
│   ├── Upcoming Rides
│   ├── Ride History
│   └── Ride Details + Receipt
│
├── Profile & Settings
│   ├── Edit Profile
│   ├── Saved Places
│   ├── Payment Methods
│   ├── Emergency Contacts
│   ├── Language Preference
│   ├── Notification Settings
│   └── Help & Support
│
└── Safety
    ├── Share Live Location
    ├── Emergency Contacts
    ├── SOS (auto-call police + share location)
    └── Ride Insurance Info
```

### 4.2 Driver App Screens

```
├── Onboarding
│   ├── Phone Verification
│   ├── Personal Details
│   ├── Vehicle Details (registration, model, fuel type)
│   ├── Document Upload (license, RC, insurance, permit, Aadhaar)
│   ├── Photo Upload (driver + vehicle)
│   └── Bank Account / UPI for Payouts
│
├── Home (Earnings Dashboard)
│   ├── Today's Earnings
│   ├── Online/Offline Toggle
│   ├── Ride Requests (accept/decline with timer)
│   ├── Current Location on Map
│   └── Subscription Status
│
├── Ride Request
│   ├── Pickup Location + Distance
│   ├── Drop Location
│   ├── Estimated Fare
│   ├── Rider Rating
│   └── Accept / Decline (15 sec timer)
│
├── Active Ride
│   ├── Navigation to Pickup
│   ├── "Arrived at Pickup" Button
│   ├── OTP Verification from Rider
│   ├── Navigation to Drop
│   ├── Live Trip Meter
│   ├── "Complete Ride" Button
│   └── Call/Chat with Rider
│
├── Earnings
│   ├── Daily / Weekly / Monthly Summary
│   ├── Ride-wise Breakdown
│   ├── Tips Received
│   ├── Subscription Fees Paid
│   └── Payout History
│
├── Subscription
│   ├── Current Plan
│   ├── Available Plans (daily/weekly/monthly)
│   ├── Payment History
│   └── Benefits Overview
│
├── Profile & Documents
│   ├── Personal Info
│   ├── Vehicle Info
│   ├── Document Status (verified/pending/expired)
│   ├── Rating & Reviews
│   └── Bank/UPI Details
│
└── Support
    ├── FAQ
    ├── Report Issue
    ├── Contact Support
    └── Safety Guidelines
```

### 4.3 Admin Dashboard

```
├── Dashboard
│   ├── Live Ride Count
│   ├── Active Drivers Map
│   ├── Revenue Today/Week/Month
│   ├── New Signups (Riders + Drivers)
│   └── Key Metrics (avg fare, avg wait time, completion rate)
│
├── Driver Management
│   ├── Driver List (search, filter by city/status)
│   ├── Document Verification Queue
│   ├── Driver Details & Activity
│   ├── Suspend/Activate Drivers
│   └── Driver Payouts
│
├── Rider Management
│   ├── Rider List
│   ├── Ride History per Rider
│   ├── Complaints & Reports
│   └── Account Actions
│
├── Ride Management
│   ├── Live Rides Map
│   ├── Ride History (filterable)
│   ├── Cancellation Reports
│   └── Dispute Resolution
│
├── Financials
│   ├── Revenue Reports
│   ├── Subscription Revenue
│   ├── Payout Reports
│   ├── Refund Management
│   └── Tax Reports (GST)
│
├── Zones & Pricing
│   ├── City/Zone Management
│   ├── Fare Configuration (per km, per min, base fare)
│   ├── Night Charges Configuration
│   └── Geofence Management
│
├── Notifications
│   ├── Push Notification Campaigns
│   ├── SMS Campaigns
│   └── In-App Announcements
│
└── Settings
    ├── Admin User Management
    ├── Role-Based Access Control
    ├── System Configuration
    └── Audit Logs
```

---

## 5. Database Schema

### 5.1 Core Tables

```sql
-- Users (both riders and drivers share base identity)
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone           VARCHAR(15) UNIQUE NOT NULL,
    email           VARCHAR(255),
    full_name       VARCHAR(100) NOT NULL,
    avatar_url      TEXT,
    language        VARCHAR(5) DEFAULT 'ml',  -- ml, en, hi
    role            VARCHAR(10) NOT NULL CHECK (role IN ('rider', 'driver', 'admin')),
    status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deactivated', 'pending_verification')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Rider-specific profile
CREATE TABLE rider_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    home_location   GEOGRAPHY(Point, 4326),
    home_address    TEXT,
    work_location   GEOGRAPHY(Point, 4326),
    work_address    TEXT,
    rating          DECIMAL(3,2) DEFAULT 5.00,
    total_rides     INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Driver-specific profile
CREATE TABLE driver_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    license_number  VARCHAR(20) NOT NULL,
    aadhaar_number  VARCHAR(12),
    rating          DECIMAL(3,2) DEFAULT 5.00,
    total_rides     INTEGER DEFAULT 0,
    total_earnings  DECIMAL(12,2) DEFAULT 0.00,
    is_online       BOOLEAN DEFAULT FALSE,
    is_on_ride      BOOLEAN DEFAULT FALSE,
    current_location GEOGRAPHY(Point, 4326),
    city            VARCHAR(50) NOT NULL,
    verified_at     TIMESTAMPTZ,
    verification_status VARCHAR(20) DEFAULT 'pending'
        CHECK (verification_status IN ('pending', 'in_review', 'verified', 'rejected')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Vehicles
CREATE TABLE vehicles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id       UUID REFERENCES driver_profiles(id) ON DELETE CASCADE,
    registration_no VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type    VARCHAR(20) DEFAULT 'auto' CHECK (vehicle_type IN ('auto', 'e_auto')),
    make            VARCHAR(50),
    model           VARCHAR(50),
    year            INTEGER,
    fuel_type       VARCHAR(20) CHECK (fuel_type IN ('petrol', 'diesel', 'cng', 'electric')),
    color           VARCHAR(30),
    seat_capacity   INTEGER DEFAULT 3,
    insurance_expiry DATE,
    permit_expiry   DATE,
    fitness_expiry  DATE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Driver Documents (KYC)
CREATE TABLE driver_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id       UUID REFERENCES driver_profiles(id) ON DELETE CASCADE,
    doc_type        VARCHAR(30) NOT NULL
        CHECK (doc_type IN ('driving_license', 'vehicle_rc', 'insurance', 'permit', 'aadhaar', 'photo', 'vehicle_photo')),
    doc_url         TEXT NOT NULL,
    doc_number      VARCHAR(50),
    expiry_date     DATE,
    status          VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
    rejection_reason TEXT,
    verified_by     UUID REFERENCES users(id),
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Rides
CREATE TABLE rides (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id        UUID REFERENCES users(id),
    driver_id       UUID REFERENCES users(id),
    vehicle_id      UUID REFERENCES vehicles(id),

    -- Locations
    pickup_location GEOGRAPHY(Point, 4326) NOT NULL,
    pickup_address  TEXT NOT NULL,
    dropoff_location GEOGRAPHY(Point, 4326) NOT NULL,
    dropoff_address TEXT NOT NULL,

    -- Route
    estimated_distance_km DECIMAL(8,2),
    actual_distance_km    DECIMAL(8,2),
    estimated_duration_min INTEGER,
    actual_duration_min    INTEGER,
    route_polyline  TEXT,

    -- Fare
    base_fare       DECIMAL(8,2),
    per_km_rate     DECIMAL(8,2),
    per_min_rate    DECIMAL(8,2),
    estimated_fare  DECIMAL(8,2) NOT NULL,
    actual_fare     DECIMAL(8,2),
    night_surcharge DECIMAL(8,2) DEFAULT 0,
    tip_amount      DECIMAL(8,2) DEFAULT 0,
    total_amount    DECIMAL(8,2),

    -- Status
    status          VARCHAR(30) NOT NULL DEFAULT 'requested'
        CHECK (status IN (
            'requested',        -- rider requested, searching for driver
            'driver_assigned',  -- driver accepted
            'driver_arrived',   -- driver at pickup
            'otp_verified',     -- rider confirmed driver identity
            'in_progress',      -- ride started
            'completed',        -- ride finished
            'cancelled_rider',  -- rider cancelled
            'cancelled_driver', -- driver cancelled
            'no_drivers'        -- no driver found
        )),

    -- OTP for ride verification
    ride_otp        VARCHAR(4),

    -- Timestamps
    requested_at    TIMESTAMPTZ DEFAULT NOW(),
    accepted_at     TIMESTAMPTZ,
    arrived_at      TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,
    cancellation_reason TEXT,

    -- Payment
    payment_method  VARCHAR(20) DEFAULT 'cash'
        CHECK (payment_method IN ('cash', 'upi', 'wallet', 'card')),
    payment_status  VARCHAR(20) DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),

    city            VARCHAR(50) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id         UUID REFERENCES rides(id),
    payer_id        UUID REFERENCES users(id),
    payee_id        UUID REFERENCES users(id),
    amount          DECIMAL(10,2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'INR',
    payment_method  VARCHAR(20) NOT NULL,
    payment_gateway VARCHAR(20),  -- razorpay, cash
    gateway_txn_id  VARCHAR(100),
    gateway_order_id VARCHAR(100),
    status          VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    failure_reason  TEXT,
    refund_amount   DECIMAL(10,2),
    refund_reason   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Wallet
CREATE TABLE wallets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID UNIQUE REFERENCES users(id),
    balance         DECIMAL(10,2) DEFAULT 0.00,
    currency        VARCHAR(3) DEFAULT 'INR',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE wallet_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id       UUID REFERENCES wallets(id),
    type            VARCHAR(20) NOT NULL CHECK (type IN ('credit', 'debit')),
    amount          DECIMAL(10,2) NOT NULL,
    description     TEXT,
    reference_type  VARCHAR(20),  -- ride, refund, topup, subscription
    reference_id    UUID,
    balance_after   DECIMAL(10,2),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Driver Subscriptions
CREATE TABLE subscription_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    name_ml         VARCHAR(100),  -- Malayalam name
    duration_days   INTEGER NOT NULL,
    price           DECIMAL(8,2) NOT NULL,
    description     TEXT,
    description_ml  TEXT,
    max_rides       INTEGER,  -- NULL = unlimited
    city            VARCHAR(50),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE driver_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id       UUID REFERENCES driver_profiles(id),
    plan_id         UUID REFERENCES subscription_plans(id),
    starts_at       TIMESTAMPTZ NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    payment_id      UUID REFERENCES payments(id),
    status          VARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('active', 'expired', 'cancelled')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Ratings & Reviews
CREATE TABLE ratings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id         UUID REFERENCES rides(id),
    rated_by        UUID REFERENCES users(id),
    rated_user      UUID REFERENCES users(id),
    rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review          TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ride_id, rated_by)
);

-- Saved Places
CREATE TABLE saved_places (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    label           VARCHAR(50) NOT NULL,  -- 'home', 'work', or custom
    address         TEXT NOT NULL,
    location        GEOGRAPHY(Point, 4326) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Emergency Contacts
CREATE TABLE emergency_contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    phone           VARCHAR(15) NOT NULL,
    relationship    VARCHAR(50),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Fare Configuration (per city)
CREATE TABLE fare_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city            VARCHAR(50) NOT NULL,
    vehicle_type    VARCHAR(20) NOT NULL,
    base_fare       DECIMAL(8,2) NOT NULL,      -- first km included
    base_distance_km DECIMAL(4,2) DEFAULT 1.5,
    per_km_rate     DECIMAL(8,2) NOT NULL,
    per_min_rate    DECIMAL(8,2) NOT NULL,       -- waiting charge
    min_fare        DECIMAL(8,2) NOT NULL,
    night_start     TIME DEFAULT '22:00',
    night_end       TIME DEFAULT '05:00',
    night_multiplier DECIMAL(3,2) DEFAULT 1.25,  -- 25% night surcharge
    is_active       BOOLEAN DEFAULT TRUE,
    effective_from  DATE NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(city, vehicle_type, effective_from)
);

-- Notifications
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    type            VARCHAR(30) NOT NULL,  -- ride_update, payment, promo, safety, system
    data            JSONB,
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_rides_rider ON rides(rider_id, status);
CREATE INDEX idx_rides_driver ON rides(driver_id, status);
CREATE INDEX idx_rides_status ON rides(status, city);
CREATE INDEX idx_rides_created ON rides(created_at DESC);
CREATE INDEX idx_driver_location ON driver_profiles USING GIST(current_location);
CREATE INDEX idx_driver_online ON driver_profiles(is_online, is_on_ride, city);
CREATE INDEX idx_payments_ride ON payments(ride_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_wallet_txn ON wallet_transactions(wallet_id, created_at DESC);
```

---

## 6. API Architecture

### 6.1 Authentication APIs

```
POST   /api/v1/auth/send-otp          Send OTP to phone number
POST   /api/v1/auth/verify-otp        Verify OTP, return JWT tokens
POST   /api/v1/auth/refresh-token     Refresh expired access token
POST   /api/v1/auth/logout            Invalidate session
```

### 6.2 Rider APIs

```
GET    /api/v1/rider/profile           Get rider profile
PUT    /api/v1/rider/profile           Update rider profile
POST   /api/v1/rider/saved-places      Add saved place
GET    /api/v1/rider/saved-places      List saved places
DELETE /api/v1/rider/saved-places/:id  Remove saved place

POST   /api/v1/rides/estimate          Get fare estimate
POST   /api/v1/rides/request           Request a ride
GET    /api/v1/rides/:id               Get ride details
POST   /api/v1/rides/:id/cancel        Cancel ride
POST   /api/v1/rides/:id/rate          Rate completed ride
GET    /api/v1/rides/history            Ride history

GET    /api/v1/rider/emergency-contacts        List emergency contacts
POST   /api/v1/rider/emergency-contacts        Add emergency contact
DELETE /api/v1/rider/emergency-contacts/:id    Remove emergency contact
POST   /api/v1/rides/:id/share-location        Share live ride location
POST   /api/v1/rides/:id/sos                   Trigger SOS alert
```

### 6.3 Driver APIs

```
GET    /api/v1/driver/profile          Get driver profile
PUT    /api/v1/driver/profile          Update driver profile
POST   /api/v1/driver/documents        Upload document
GET    /api/v1/driver/documents        List documents & status
PUT    /api/v1/driver/vehicle          Update vehicle info

POST   /api/v1/driver/go-online        Go online (start accepting rides)
POST   /api/v1/driver/go-offline       Go offline
PUT    /api/v1/driver/location         Update current location

POST   /api/v1/driver/rides/:id/accept   Accept ride request
POST   /api/v1/driver/rides/:id/decline  Decline ride request
POST   /api/v1/driver/rides/:id/arrived  Mark arrived at pickup
POST   /api/v1/driver/rides/:id/verify-otp  Verify rider OTP
POST   /api/v1/driver/rides/:id/start   Start ride
POST   /api/v1/driver/rides/:id/complete Complete ride
POST   /api/v1/driver/rides/:id/cancel   Cancel ride

GET    /api/v1/driver/earnings          Earnings summary
GET    /api/v1/driver/earnings/history  Detailed earnings history

GET    /api/v1/driver/subscriptions/plans     Available plans
POST   /api/v1/driver/subscriptions/subscribe Subscribe to plan
GET    /api/v1/driver/subscriptions/current   Current subscription
```

### 6.4 Payment APIs

```
POST   /api/v1/payments/create-order   Create Razorpay order
POST   /api/v1/payments/verify         Verify payment
GET    /api/v1/payments/:id            Get payment details

GET    /api/v1/wallet/balance           Get wallet balance
POST   /api/v1/wallet/topup            Add money to wallet
GET    /api/v1/wallet/transactions     Transaction history
```

### 6.5 WebSocket Events (Real-time)

```
-- Rider Events
ride:searching              Searching for driver
ride:driver_assigned        Driver found and assigned
ride:driver_location        Driver location update (every 3s)
ride:driver_arrived         Driver arrived at pickup
ride:started                Ride started
ride:location_update        Live ride tracking (every 3s)
ride:completed              Ride completed
ride:cancelled              Ride cancelled
ride:no_drivers             No drivers available

-- Driver Events
ride:new_request            New ride request (15s to accept)
ride:request_timeout        Request expired
ride:rider_cancelled        Rider cancelled
ride:navigation_update      Turn-by-turn navigation updates

-- Common
notification:new            New notification
```

### 6.6 Admin APIs

```
GET    /api/v1/admin/dashboard/stats       Dashboard statistics
GET    /api/v1/admin/rides                 All rides (filterable)
GET    /api/v1/admin/rides/live            Live rides
GET    /api/v1/admin/drivers               Driver list
GET    /api/v1/admin/drivers/:id           Driver details
PUT    /api/v1/admin/drivers/:id/verify    Verify/reject driver
PUT    /api/v1/admin/drivers/:id/status    Suspend/activate driver
GET    /api/v1/admin/riders                Rider list
GET    /api/v1/admin/documents/pending     Pending document verifications
PUT    /api/v1/admin/documents/:id/verify  Verify/reject document
GET    /api/v1/admin/financials/revenue    Revenue reports
GET    /api/v1/admin/financials/payouts    Payout reports
POST   /api/v1/admin/fare-config           Create/update fare config
POST   /api/v1/admin/notifications/send    Send push notification
```

---

## 7. Core Algorithms

### 7.1 Driver Matching Algorithm

```
INPUT: rider pickup location, ride details
OUTPUT: best matched driver

1. Query Redis GEOSEARCH for online drivers within 3km radius
2. Filter: is_online=true, is_on_ride=false, has_active_subscription=true
3. Score each driver:
   score = (0.4 × proximity_score)     -- closer = higher
         + (0.3 × rating_score)         -- higher rated = higher
         + (0.2 × acceptance_rate)       -- more reliable = higher
         + (0.1 × ride_count_today)      -- fair distribution (fewer rides = higher)
4. Sort by score descending
5. Send request to top driver with 15-second timeout
6. If declined/timeout → send to next driver
7. If no driver accepts within 3 rounds → return "no_drivers"
```

### 7.2 Fare Calculation

```
INPUT: pickup_location, dropoff_location, current_time, city
OUTPUT: estimated_fare

1. Get route from Google Directions API → distance_km, duration_min
2. Load fare_config for city + vehicle_type
3. Calculate:
   fare = base_fare
   if distance_km > base_distance_km:
       fare += (distance_km - base_distance_km) × per_km_rate
   fare += duration_min × per_min_rate

   if current_time is between night_start and night_end:
       fare × = night_multiplier

   fare = max(fare, min_fare)
4. Return fare rounded to nearest rupee
```

### 7.3 ETA Calculation

```
INPUT: driver_location, pickup_location
OUTPUT: estimated_time_of_arrival

1. Get route from Google Directions API with traffic model
2. Apply Kerala-specific adjustments:
   - Rain factor: +20% during monsoon months (Jun-Sep)
   - Festival factor: +15% during Onam, Vishu
   - Rush hour factor: +10% during 8-10 AM, 5-8 PM
3. Return adjusted ETA in minutes
```

---

## 8. Security Architecture

### 8.1 Authentication & Authorization

- **OTP-based auth** — no passwords, phone number is identity
- **JWT tokens** — short-lived access tokens (15 min) + long-lived refresh tokens (30 days)
- **Role-based access** — rider, driver, admin with middleware guards
- **Device binding** — track device ID, flag suspicious multi-device activity

### 8.2 Data Protection

- **Encryption at rest** — AES-256 for sensitive fields (Aadhaar, phone in DB)
- **Encryption in transit** — TLS 1.3 everywhere
- **Phone number masking** — during rides, neither party sees real phone numbers (use virtual numbers or masked calling via Exotel)
- **PII handling** — DPDP Act 2023 compliance (India's data protection law)
- **KYC documents** — stored encrypted in S3 with restricted access policies

### 8.3 Ride Safety

- **Ride OTP** — 4-digit OTP shared with rider, driver must verify before starting
- **Live location sharing** — rider can share live trip with emergency contacts
- **SOS button** — one-tap emergency that: records audio, shares location with contacts + admin, optionally calls 112
- **Route deviation alerts** — alert rider if driver deviates >500m from planned route
- **Driver verification** — background check, license validation, vehicle fitness check

---

## 9. Deployment Architecture

### 9.1 MVP (Phase 1) — Simple & Cost-Effective

```
┌─────────────────────────────────────────┐
│              AWS Mumbai Region           │
│                                          │
│  ┌────────────┐   ┌──────────────────┐  │
│  │ EC2 (t3.medium)│  │ RDS PostgreSQL │  │
│  │             │   │  (db.t3.medium)  │  │
│  │ • Node.js  │   │                   │  │
│  │ • Nginx    │   │  + PostGIS        │  │
│  │ • Redis    │   │                   │  │
│  │ • Socket.io│   └──────────────────┘  │
│  └────────────┘                          │
│                                          │
│  ┌────────────┐   ┌──────────────────┐  │
│  │ S3 Bucket  │   │  CloudFront CDN  │  │
│  │ (storage)  │   │  (assets)        │  │
│  └────────────┘   └──────────────────┘  │
│                                          │
└─────────────────────────────────────────┘

Estimated Cost: ₹15,000-25,000/month
```

### 9.2 Scale (Phase 3+) — Production at Scale

```
┌──────────────────────────────────────────────────┐
│                 AWS Mumbai Region                  │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │              ECS Fargate Cluster              │ │
│  │                                                │ │
│  │  ┌─────────┐ ┌─────────┐ ┌───────────────┐  │ │
│  │  │Auth Svc │ │Ride Svc │ │ Location Svc  │  │ │
│  │  │(2 tasks)│ │(3 tasks)│ │  (3 tasks)    │  │ │
│  │  └─────────┘ └─────────┘ └───────────────┘  │ │
│  │  ┌─────────┐ ┌─────────┐ ┌───────────────┐  │ │
│  │  │Pay Svc  │ │Notif Svc│ │Analytics Svc  │  │ │
│  │  │(2 tasks)│ │(2 tasks)│ │  (1 task)     │  │ │
│  │  └─────────┘ └─────────┘ └───────────────┘  │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │RDS PG    │  │ElastiCache│  │    ALB         │  │
│  │(Primary  │  │ Redis     │  │ (Load Balancer)│  │
│  │+ Replica)│  │ (Cluster) │  │                │  │
│  └──────────┘  └──────────┘  └────────────────┘  │
│                                                    │
└──────────────────────────────────────────────────┘

Estimated Cost: ₹60,000-1,00,000/month
```

---

## 10. Project Structure

```
hey-auto/
├── apps/
│   ├── rider-app/                    # React Native Rider App
│   │   ├── src/
│   │   │   ├── app/                  # App entry, providers, navigation
│   │   │   ├── features/
│   │   │   │   ├── auth/             # Login, OTP, profile setup
│   │   │   │   ├── home/             # Map view, search, nearby drivers
│   │   │   │   ├── booking/          # Ride request flow
│   │   │   │   ├── ride/             # Active ride tracking
│   │   │   │   ├── history/          # Past rides
│   │   │   │   ├── payments/         # Payment methods, wallet
│   │   │   │   ├── profile/          # User profile, settings
│   │   │   │   └── safety/           # SOS, emergency, share ride
│   │   │   ├── components/           # Shared UI components
│   │   │   ├── hooks/                # Custom hooks
│   │   │   ├── services/             # API client, socket service
│   │   │   ├── utils/                # Helpers, constants
│   │   │   ├── i18n/                 # Translations (ml, en, hi)
│   │   │   └── theme/                # Colors, typography, spacing
│   │   ├── android/
│   │   ├── ios/
│   │   └── package.json
│   │
│   ├── driver-app/                   # React Native Driver App
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── features/
│   │   │   │   ├── auth/             # Login, OTP, onboarding
│   │   │   │   ├── home/             # Dashboard, online toggle
│   │   │   │   ├── rides/            # Ride requests, active ride
│   │   │   │   ├── earnings/         # Earnings, payouts
│   │   │   │   ├── subscription/     # Plans, payment
│   │   │   │   ├── documents/        # KYC upload, status
│   │   │   │   └── profile/          # Profile, vehicle, settings
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   ├── utils/
│   │   │   ├── i18n/
│   │   │   └── theme/
│   │   ├── android/
│   │   ├── ios/
│   │   └── package.json
│   │
│   └── admin-dashboard/              # React Web Admin Panel
│       ├── src/
│       │   ├── pages/
│       │   ├── components/
│       │   ├── hooks/
│       │   ├── services/
│       │   └── utils/
│       └── package.json
│
├── packages/
│   └── shared/                       # Shared types, utils, constants
│       ├── src/
│       │   ├── types/                # TypeScript interfaces
│       │   ├── constants/            # Fare rates, status enums
│       │   └── utils/                # Shared helpers
│       └── package.json
│
├── server/
│   ├── src/
│   │   ├── config/                   # Environment, database config
│   │   ├── middleware/               # Auth, validation, error handling
│   │   ├── modules/
│   │   │   ├── auth/                 # Auth routes, controller, service
│   │   │   ├── rider/                # Rider routes, controller, service
│   │   │   ├── driver/               # Driver routes, controller, service
│   │   │   ├── ride/                 # Ride routes, controller, service
│   │   │   ├── payment/              # Payment routes, controller, service
│   │   │   ├── notification/         # Push, SMS, in-app notifications
│   │   │   ├── location/             # Real-time location, geofencing
│   │   │   ├── admin/                # Admin routes, controller, service
│   │   │   └── analytics/            # Reporting, metrics
│   │   ├── socket/                   # Socket.io event handlers
│   │   ├── jobs/                     # Background jobs (cron, queues)
│   │   ├── utils/                    # Helpers, logger, errors
│   │   └── app.ts                    # Express app setup
│   ├── prisma/
│   │   ├── schema.prisma             # Database schema
│   │   └── migrations/               # Migration files
│   ├── tests/
│   └── package.json
│
├── docker-compose.yml                # Local dev: PG + Redis + Server
├── .github/
│   └── workflows/                    # CI/CD pipelines
├── turbo.json                        # Turborepo config (monorepo)
├── package.json                      # Root package.json
└── README.md
```

---

## 11. Implementation Phases

### Phase 1: MVP for Taliparamba (Weeks 1-12)

**Target**: Taliparamba town, Kannur District (~1 lakh population, 18.96 sq km)

**Weeks 1-3: Foundation**
- [ ] Monorepo setup (Turborepo + shared packages)
- [ ] Backend: Express server, PostgreSQL + Prisma, Redis, auth module
- [ ] Rider App: project setup, navigation, auth flow (OTP login)
- [ ] Driver App: project setup, navigation, auth flow (OTP login)

**Weeks 4-6: Core Ride Flow**
- [ ] Rider: home map, location search, fare estimate, ride request
- [ ] Driver: go online/offline, receive ride request, accept/decline
- [ ] Backend: matching algorithm, fare calculation, ride lifecycle
- [ ] Real-time: Socket.io for driver location, ride status updates
- [ ] Pre-load Taliparamba key locations (bus stand, Kannapuram station, temples, hospitals, schools)

**Weeks 7-9: Payments & Tracking**
- [ ] Cash payment as default (most common in small towns)
- [ ] UPI payment via Razorpay (GPay/PhonePe widely used in Kerala)
- [ ] Live ride tracking (rider sees driver on map)
- [ ] Ride OTP verification
- [ ] Rating system post-ride
- [ ] Ride history

**Weeks 10-12: Polish & Taliparamba Launch**
- [ ] Malayalam-first interface (English as secondary)
- [ ] Safety features (SOS, share ride, emergency contacts)
- [ ] Driver onboarding — visit auto stands in person across Taliparamba
- [ ] Admin dashboard (basic: driver verification, ride monitoring)
- [ ] Push notifications
- [ ] Taliparamba-specific geofencing (town boundary)
- [ ] Testing with 50-100 drivers, 200-500 riders (friends, family, local community)
- [ ] Play Store submission (Android first — dominant in Kerala small towns)

### Phase 2: Kannur District Expansion (Weeks 13-24)
- Expand to Kannur city, Payyanur, Iritty, Thalassery
- Driver subscription system (₹15-25/day plans)
- Advanced admin dashboard
- Wallet system for riders
- Referral program (₹50 per referral — powerful in tight-knit communities)
- Kannur Railway Station ↔ town last-mile service
- iOS App Store submission

### Phase 3: North Kerala (Weeks 25-36)
- Expand to Calicut, Kasaragod, Wayanad
- Tourism routes (Wayanad, Bekal Fort, Muzhappilangad Beach)
- E-auto support
- KSRTC bus stand last-mile integration
- Driver welfare fund
- Analytics and reporting

### Phase 4: All Kerala (Weeks 37-52)
- Kochi, Thrissur, Thiruvananthapuram, Kollam
- Kochi Metro last-mile connectivity
- Multi-vehicle type (auto + e-auto + taxi)
- Advanced fraud detection
- Tourism packages (Munnar, Alleppey backwaters)

---

## 12. Taliparamba-Specific Features (MVP)

| Feature | Description |
|---------|-------------|
| **Malayalam-First UI** | Full Malayalam interface, English toggle for visitors |
| **Pre-loaded Locations** | Bus Stand, Kannapuram Railway Stn, Trichambaram Temple, Rajarajeshwara Temple, Govt Hospital, Schools, Markets |
| **Cash-First Payments** | Cash as default (small town reality), UPI as secondary |
| **Auto Stand Mapping** | Map all major auto stands in Taliparamba for quick pickup |
| **Flat Town Rates** | Simple fare: ₹30 base + ₹15/km (matches Kerala govt meter rate) |
| **Railway Station Shuttle** | Quick-book to Kannapuram Railway Station (10 km) |
| **Monsoon Mode** | Adjusted ETAs during heavy rain (Jun-Sep) |
| **Hartal Alerts** | Notify users about hartals affecting service |
| **Auto Union Compliance** | Work with local auto unions, display union ID |
| **WhatsApp Booking** | For users not comfortable with apps (Phase 2) |

### Future Kerala-Wide Features (Phase 3+)

| Feature | Description |
|---------|-------------|
| **Tourism Packages** | Fixed-rate packages for Wayanad, Bekal, Munnar day trips |
| **KSRTC Integration** | Book auto for last-mile from bus stops |
| **Flood Safety** | During flood season, show safe routes, disable flooded areas |
| **Fish Market Timings** | Early morning auto routes to fish markets |
| **Malayalam Voice Search** | Search destinations by speaking in Malayalam |
| **Festival Mode** | Transparent pricing during Onam, Vishu, Christmas |

---

## 13. Cost Estimates — Taliparamba MVP

**Small town = dramatically lower costs than launching in a metro city.**

| Item | Taliparamba MVP | Kannur District | All Kerala |
|------|----------------|-----------------|------------|
| Cloud Hosting (GCP/DO) | ₹0 (free credits) | ₹5,000 | ₹60,000 |
| Google Maps API | ₹0 (free tier) | ₹5,000 | ₹40,000 |
| SMS/OTP (MSG91) | ₹500 | ₹3,000 | ₹20,000 |
| Razorpay | ₹0 (mostly cash) | 2% per txn | 2% per txn |
| Firebase (Push) | Free | Free | ₹3,000 |
| Sentry | Free | Free | ₹2,200 |
| Domain (heyauto.in) | ₹700/yr | ₹700/yr | ₹700/yr |
| Google Play Console | ₹2,100 (one-time) | — | — |
| Apple Developer | — (Android first) | ₹8,300/yr | ₹8,300/yr |
| **Total** | **~₹1,500/mo** | **~₹15,000/mo** | **~₹1,30,000/mo** |

**Why it's so cheap for Taliparamba:**
- Free cloud credits cover 3-4 months
- Low ride volume = Google Maps free tier is sufficient (~40K direction calls/mo)
- Mostly cash payments = near-zero payment gateway cost
- Android-only launch = no Apple developer fee
- ~100-200 rides/day = minimal server resources needed

---

## 14. Success Metrics (KPIs)

| Metric | Taliparamba MVP (3 mo) | Kannur District (6 mo) | All Kerala (18 mo) |
|--------|----------------------|------------------------|---------------------|
| Registered Riders | 2,000 | 25,000 | 2,00,000 |
| Registered Drivers | 200 | 2,000 | 15,000 |
| Daily Rides | 50-100 | 1,000 | 10,000 |
| Avg. Wait Time | < 7 min | < 5 min | < 3 min |
| Ride Completion Rate | > 75% | > 85% | > 90% |
| Driver Rating Avg | > 4.0 | > 4.2 | > 4.5 |
| App Crash Rate | < 2% | < 1% | < 0.1% |
| Driver Onboarding | 50% of Taliparamba autos | 30% of district autos | 25% of Kerala autos |

---

*This architecture is designed to start lean (single server MVP) and scale horizontally as Hey Auto grows across Kerala. Every decision prioritizes speed to market for Phase 1, with clear upgrade paths for Phase 2+.*
