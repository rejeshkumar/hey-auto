# Hey Auto vs. Namma Yatri — Feature & Technical Gap Analysis

**Date:** 2026-04-26  
**Reference:** Namma Yatri BRD v1.0, TDD v1.0 (scraped 2026-04-23)  
**Scope:** Feature completeness, technical architecture, compliance

---

## 1. Executive Summary

Hey Auto has a fully working end-to-end ride platform — auth, booking, real-time tracking, fare calculation, payments, ratings, push notifications, subscriptions, and admin console are all in place. The comparison with Namma Yatri reveals two tiers of gaps:

- **Tier 1 — Near-term product gaps:** Features that directly affect rider/driver experience and could be built in weeks (cancellation grace period, masked phone, scheduled rides, receipt download).
- **Tier 2 — Longer-term platform gaps:** Infrastructure and compliance items that matter at scale (cloud document storage, analytics, DPDP compliance, multi-city sharding, ONDC/Beckn integration).

Hey Auto's focus on a single small-city market (Taliparamba) means many Namma Yatri features exist for a scale and regulatory context Hey Auto hasn't reached yet. This document distinguishes which gaps matter *now* vs. *at scale*.

---

## 2. Functional Feature Comparison

### 2.1 Rider App

| Feature | Namma Yatri | Hey Auto | Gap / Notes |
|---|---|---|---|
| Phone OTP login | ✅ | ✅ | — |
| Ride booking with upfront fare estimate | ✅ | ✅ | — |
| Itemized fare breakdown (base + km + time + night) | ✅ | ✅ | — |
| Real-time driver location on map | ✅ | ✅ | — |
| OTP ride start verification | ✅ | ✅ | — |
| Rate driver after ride (1–5 stars) | ✅ | ✅ | — |
| Add tip after ride | ✅ | ✅ | — |
| Ride cancellation | ✅ | ✅ | — |
| Push notifications (driver found, arrived, completed) | ✅ | ✅ | — |
| SOS / emergency alert | ✅ | ✅ | Hey Auto calls 112 + notifies server; NY also supports masked call relay |
| Emergency contacts management | ✅ | ✅ | — |
| Saved places (home / work) | ✅ | ✅ | — |
| Ride history | ✅ | ✅ | — |
| Edit profile | ✅ | ✅ | — |
| Malayalam language support | ✅ | ✅ | — |
| English language support | ✅ | ✅ | — |
| **Scheduled / advance ride booking** | ✅ BR-003 | ❌ | Up to 24 hrs in advance — Tier 1 |
| **Cancellation grace period (free cancel window)** | ✅ BR-027 | ❌ | NY: 3-min free cancel; beyond that a fee applies — Tier 1 |
| **Cancellation fee charged to rider** | ✅ BR-028 | ❌ | Depends on grace period above — Tier 1 |
| **Digital receipt download / email (12 months)** | ✅ BR-017 | ❌ | Receipt shown on screen; no persistent download link — Tier 1 |
| **Masked phone channel (driver/rider call via platform)** | ✅ BR-019 | ❌ | Hey Auto exposes real phone numbers; NY routes via masked number — Tier 1 |
| **Multi-modal trip planning (auto + bus)** | ✅ BR-031 | ❌ | Requires GTFS feed integration — Tier 2 |
| **Beckn / ONDC network booking** | ✅ BR-004 | ❌ | Proprietary only; no open protocol — Tier 2 |
| **Aggregate driver rating visible before booking** | ✅ BR-026 | ✅ | Shown on driver card in active ride screen |
| **Data export (DPDP right to portability)** | ✅ NFR-017 | ❌ | No self-service export — Tier 2 |
| **Data deletion request (DPDP right to erasure)** | ✅ NFR-017 | ❌ | No in-app deletion flow — Tier 2 |
| **Screen reader accessibility** | ✅ NFR-018 | ❌ | Not tested/implemented — Tier 2 |
| Hindi / Tamil / Kannada / Telugu language support | ✅ | ❌ | Hey Auto is ML + EN only; OK for Taliparamba — Tier 2 |

---

### 2.2 Driver App

| Feature | Namma Yatri | Hey Auto | Gap / Notes |
|---|---|---|---|
| Phone OTP login | ✅ | ✅ | — |
| Go online / offline | ✅ | ✅ | — |
| Incoming ride request card (with timer) | ✅ | ✅ | — |
| Accept / decline ride | ✅ | ✅ | — |
| Turn-by-turn navigation to pickup | ✅ | ✅ | — |
| Mark arrived at pickup | ✅ | ✅ | — |
| OTP verification to start ride | ✅ | ✅ | — |
| Complete ride | ✅ | ✅ | — |
| Rate rider after ride | ✅ | ✅ | — |
| Push notifications for new requests (when backgrounded) | ✅ | ✅ | — |
| Call rider (real phone) | ✅ | ✅ | Fixed in latest session |
| Earnings summary (today / week / month) | ✅ | ✅ | — |
| Ride history | ✅ | ✅ | — |
| Document upload (DL, RC, insurance, permit, Aadhaar) | ✅ | ✅ | — |
| Subscription / daily access fee | ✅ (commission) | ✅ | NY uses % commission; Hey Auto uses flat ₹25/day |
| Malayalam language support | ✅ | ✅ | — |
| **Document upload to cloud storage** | ✅ | ❌ | Hey Auto stores device-local URI; admin can't view — Tier 1 |
| **Masked phone channel to rider** | ✅ BR-019 | ❌ | Real number exposed — Tier 1 |
| **Cancellation rate tracking visible to driver** | ✅ BR-029 | ❌ | Rate is tracked in DB but not shown — Tier 1 |
| **Scheduled ride alerts** | ✅ | ❌ | Depends on scheduled booking feature — Tier 1 |
| **RTO licence / vehicle RC validation** | ✅ BR-022 | ❌ | Manual admin review only — Tier 2 |
| **Data export / deletion** | ✅ | ❌ | — Tier 2 |

---

### 2.3 Admin Console

| Feature | Namma Yatri | Hey Auto | Gap / Notes |
|---|---|---|---|
| Dashboard (stats: riders, drivers, rides, revenue) | ✅ | ✅ | — |
| Active rides live view | ✅ | ✅ | — |
| Driver list / search / filter | ✅ | ✅ | — |
| Rider list / search | ✅ | ✅ | — |
| Document verification queue | ✅ | ✅ | — |
| Document image viewing (lightbox) | ✅ | ✅ | — |
| Driver verify / reject with push notification | ✅ | ✅ | — |
| Subscription / payment verification queue | — (NY uses % model) | ✅ | Hey Auto-specific — UTR verify flow |
| Fare configuration | ✅ | ✅ | — |
| Ride history with filters | ✅ | ✅ | — |
| **Real-time driver location heatmap** | ✅ BR-032 | ❌ | Demand/supply map by zone — Tier 1 |
| **Broadcast messaging to driver segments** | ✅ BR-020 | ❌ | No comms dashboard equivalent — Tier 1 |
| **Driver cancellation rate alerts** | ✅ BR-029 | ❌ | Not surfaced in admin — Tier 1 |
| **RTO database integration for doc verification** | ✅ BR-022 | ❌ | Manual checklist only — Tier 2 |
| **Analytics dashboard (ClickHouse)** | ✅ BR-032 | ❌ | No analytics layer at all — Tier 2 |
| **Multi-city management** | ✅ | ❌ | Single city (Taliparamba) — Tier 2 |

---

## 3. Technical Architecture Comparison

| Component | Namma Yatri | Hey Auto | Gap |
|---|---|---|---|
| **Core backend language** | Haskell (type-safe, functional) | Node.js + TypeScript + Prisma | Different philosophy; both valid |
| **Mobile apps** | PureScript + React Native | React Native (Expo) | — |
| **Primary DB** | PostgreSQL (city-sharded) | PostgreSQL (single schema) | Multi-city sharding not needed yet |
| **Cache / pub-sub** | Redis (Geo, Streams, Hashes) | Redis (pub/sub + active ride keys) | Hey Auto uses basic pub/sub; NY uses Streams with consumer groups + Geo index |
| **Driver geospatial matching** | Redis `GEOADD / GEOSEARCH` | Redis keys + Haversine in Node.js | **Gap:** At >1,000 online drivers, Haversine loop in Node will be slow. Should migrate to Redis `GEOSEARCH` |
| **Location tracking** | Dedicated Rust service (100K GPS/min) | Node.js route handler + Redis key | OK for small city; replace at scale |
| **Notifications** | Rust gRPC bidirectional stream + FCM fallback | Socket.io + FCM (expo-notifications) | Socket.io is fine for small scale |
| **Routing engine** | Self-hosted OSRM | Google Maps API (assumed) / external | OSRM is free & offline; relevant at scale for cost |
| **Analytics** | ClickHouse + Prometheus + Grafana | None | **Gap:** No metrics, no funnel analysis, no ops visibility |
| **Fare estimate caching** | Redis short-TTL cache | No caching (live OSRM call each time) | Minor; add Redis cache for repeated routes |
| **Circuit breakers** | Yes (on all downstream deps) | No | Maps/external API failures bubble up |
| **Document storage** | Encrypted cloud (AES-256) | Device-local URI (broken in admin) | **Gap — Tier 1:** Need S3 or equivalent |
| **Database connection pooling** | PgBouncer | Prisma connection pool (default) | Prisma default is fine for small scale |
| **Feature flags** | Superposition (PLpgSQL) | None | Not needed yet |
| **Beckn / ONDC integration** | Full (core protocol layer) | None | Tier 2 — needed for network interoperability |
| **Multi-city DB sharding** | Per-city schema namespacing | Single schema | Tier 2 |
| **Encryption at rest (AES-256)** | Yes (storage volume) | Relies on cloud provider default | Tier 2 |
| **Reproducible builds (Nix)** | Yes | npm / standard Node toolchain | Not needed at current scale |
| **Load testing** | Jupyter + staging environment | None | Tier 2 |

---

## 4. Compliance & Safety Comparison

| Area | Namma Yatri | Hey Auto | Gap |
|---|---|---|---|
| Push notifications for ride events | ✅ | ✅ | — |
| SOS with emergency contacts | ✅ | ✅ | — |
| Cancellation grace period | ✅ | ❌ | Tier 1 |
| Masked driver/rider phone channel | ✅ | ❌ | Tier 1 — phones currently exposed |
| KYC document verification | ✅ (manual + RTO API) | ✅ (manual only) | RTO API integration = Tier 2 |
| DPDP Act — data localisation | ✅ | Not explicitly addressed | Tier 2 |
| DPDP Act — right to erasure | ✅ | ❌ | Tier 2 |
| DPDP Act — data export | ✅ | ❌ | Tier 2 |
| Consent records stored at signup | ✅ | ❌ | Tier 2 |
| Soft-delete (audit trail preserved) | ✅ | ❌ (hard deletes) | Tier 2 |
| GPS trail retention for dispute (90 days) | ✅ | ❌ | Route polyline stored per ride but no explicit retention policy |
| Digital receipt (12-month access) | ✅ | ❌ | Tier 1 |
| Algorithmic deactivation — human review required | ✅ | ✅ (admin manually verifies) | — |

---

## 5. Prioritised Gap Backlog

### Tier 1 — Build Next (Product Impact, Feasible in Weeks)

| # | Feature | Why It Matters |
|---|---|---|
| 1 | **Cloud document upload (S3)** | Admin can't view driver documents; currently broken | 
| 2 | **Cancellation grace period + fee** | Protects drivers from last-minute no-shows; standard in every ride app |
| 3 | **Cancellation rate shown to driver + admin alert** | Driver accountability; already tracked in DB, just not surfaced |
| 4 | **Digital receipt (persistent, shareable)** | Riders need proof for expense claims; store ride summary as PDF or shareable link |
| 5 | **Real-time driver heatmap in admin** | Ops visibility — know where supply/demand are mismatched in real time |
| 6 | **Broadcast messaging to drivers** | Push announcements (fare changes, policy updates, festival bonuses) |
| 7 | **Scheduled / advance ride booking** | Common request for airport runs, early morning hospital trips |

### Tier 2 — Build at Scale (Infrastructure / Compliance)

| # | Feature | When It Matters |
|---|---|---|
| 1 | **Redis `GEOSEARCH` for driver matching** | When >500 drivers online simultaneously |
| 2 | **Masked phone channel** | When privacy regulation or driver harassment becomes a concern |
| 3 | **Analytics layer (ClickHouse or equivalent)** | When you need funnel analysis, demand forecasting, driver retention metrics |
| 4 | **DPDP compliance (erasure, export, consent)** | Before scaling beyond beta / before institutional partnerships |
| 5 | **Multi-city database sharding** | When expanding beyond Taliparamba |
| 6 | **RTO database validation for KYC** | When volume makes manual review a bottleneck |
| 7 | **Beckn / ONDC integration** | For network interoperability with other BAPs; required for ONDC participation |
| 8 | **Self-hosted OSRM routing** | When Google Maps API costs become significant at scale |
| 9 | **Circuit breakers on Maps / FCM** | When external API failures must not crash ride flow |
| 10 | **GTFS bus integration + multi-modal** | If expanding to cover last-mile + bus combos |

---

## 6. What Hey Auto Does Better Than Namma Yatri

Hey Auto is a focused, small-city product with deliberate simplifications that Namma Yatri doesn't have:

| Area | Hey Auto Advantage |
|---|---|
| **Subscription model vs. commission** | Flat ₹25/day subscription is more predictable for drivers than per-ride commission tracking. Namma Yatri's zero-commission is the same goal, but their funding model differs. |
| **Admin UTR verification queue** | Manual payment verification is specific to Hey Auto's UPI-manual flow — a practical solution for the Taliparamba market where drivers may not have smart payment terminals. |
| **Malayalam-first UX** | Namma Yatri started in Bengaluru (Kannada/English focus); Hey Auto is built Malayalam-first from day one, which is the right call for Taliparamba. |
| **Simpler deployment** | Single Node.js server vs. a polyglot Haskell/Rust/Java/Go/PureScript microservices cluster. Hey Auto can run on a single VPS. Namma Yatri requires a team of infrastructure engineers. |
| **Expo-based build** | Expo + EAS makes app builds and OTA updates far simpler than Namma Yatri's React Native + PureScript + custom native modules setup. |

---

*Generated: 2026-04-26 | Source: `/Users/rejesh.kumar/Desktop/Project- AI/Hey Auto/scrape/nammayatri_BRD.md`, `nammayatri_TDD.md`*
