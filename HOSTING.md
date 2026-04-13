# Hey Auto - Hosting & Infrastructure Guide

## Your App Needs These Services Running 24/7

| Service | What It Does | Resource Need |
|---------|-------------|---------------|
| **Node.js API Server** | Handles all REST APIs, business logic | CPU + RAM |
| **Socket.io Server** | Real-time ride tracking, driver location | Persistent connections, RAM |
| **PostgreSQL + PostGIS** | All data storage, geospatial queries | Storage + RAM |
| **Redis** | Driver locations cache, sessions, pub/sub | RAM |
| **S3-compatible Storage** | KYC docs, photos, receipts | Storage only |
| **CDN** | App assets, static files | Bandwidth |

---

## Hosting Options Compared

### Option 1: AWS (Amazon Web Services) — RECOMMENDED for Production

**Why**: Mumbai region (ap-south-1) = lowest latency to Kerala users. Most services available. Industry standard.

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS Mumbai (ap-south-1)                    │
│                                                              │
│  MVP Setup:                                                  │
│  ┌──────────────────┐  ┌─────────────────────────────────┐  │
│  │ EC2 t3.medium    │  │ RDS PostgreSQL db.t3.micro      │  │
│  │ 2 vCPU, 4GB RAM  │  │ (Free tier 12 months)           │  │
│  │ Node.js + Redis  │  │ 20GB storage + PostGIS          │  │
│  │ + Socket.io      │  │                                  │  │
│  │ ₹2,780/mo        │  │ ₹0 (free) → ₹2,500/mo after   │  │
│  └──────────────────┘  └─────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────┐  ┌─────────────────────────────────┐  │
│  │ S3 Bucket        │  │ CloudFront CDN                   │  │
│  │ KYC docs, photos │  │ Fast delivery across Kerala      │  │
│  │ ~₹100/mo         │  │ ~₹500/mo                        │  │
│  └──────────────────┘  └─────────────────────────────────┘  │
│                                                              │
│  MVP Total: ~₹6,000-8,000/mo (with free tier)               │
│  Post Free Tier: ~₹15,000-20,000/mo                         │
│  At Scale: ~₹60,000-1,00,000/mo                             │
└─────────────────────────────────────────────────────────────┘
```

| Component | Service | Cost/Month |
|-----------|---------|------------|
| API + Socket.io | EC2 t3.medium (2 vCPU, 4GB) | ₹2,780 |
| Database | RDS PostgreSQL db.t3.micro | Free 12mo → ₹2,500 |
| Cache | ElastiCache Redis t3.micro | Free 12mo → ₹2,200 |
| File Storage | S3 (10GB) | ~₹100 |
| CDN | CloudFront | ~₹500 |
| Domain + SSL | Route 53 + ACM | ₹400 |
| **MVP Total** | | **~₹6,000/mo** (with free tier) |

**Pros:**
- Mumbai data center = ~20ms latency to Kerala (best possible)
- 12-month free tier covers database + cache during MVP
- Auto-scaling when you grow
- Every service you'll ever need exists on AWS
- Industry standard — easy to hire developers who know it

**Cons:**
- Complex pricing, easy to get surprise bills
- Steeper learning curve vs simpler platforms
- Need more DevOps knowledge

**Free Tier (12 months):**
- 750 hrs/mo EC2 t3.micro
- 750 hrs/mo RDS db.t3.micro (20GB)
- 750 hrs/mo ElastiCache t3.micro
- 5GB S3 storage
- 1M Lambda invocations/mo

---

### Option 2: Google Cloud Platform (GCP) — BEST Value

**Why**: Chennai region (asia-south1) is physically closest to Kerala. 15-25% cheaper than AWS. Best free tier.

| Component | Service | Cost/Month |
|-----------|---------|------------|
| API + Socket.io | Compute Engine e2-medium (2 vCPU, 4GB) | ₹2,400 |
| Database | Cloud SQL PostgreSQL (db-f1-micro) | Free always → ₹2,000 |
| Cache | Memorystore Redis (1GB) | ₹2,500 |
| File Storage | Cloud Storage (10GB) | ~₹80 |
| CDN | Cloud CDN | ~₹400 |
| Domain + SSL | Cloud DNS + managed SSL | ₹200 |
| **MVP Total** | | **~₹5,500/mo** (with free tier) |

**Pros:**
- **Chennai data center** — physically closest to Kerala (~15ms latency)
- 15-25% cheaper than AWS on comparable compute
- $300 free trial credit (90 days)
- Always-free e2-micro VM (can run small background jobs forever)
- Firebase integration (already using FCM for push notifications)
- Google Maps API discount if hosting on GCP

**Cons:**
- Smaller ecosystem than AWS
- Fewer managed services
- Less hiring pool familiar with GCP in India

**Always-Free Tier (permanent):**
- 1x e2-micro VM (2 shared vCPU, 1GB RAM)
- 30GB disk
- 1GB Cloud Storage
- Firestore: 50K reads/day
- Cloud Run: 2M requests/mo

---

### Option 3: DigitalOcean — SIMPLEST to Start

**Why**: Predictable pricing, no bill shock. Great developer experience. Bangalore data center.

| Component | Service | Cost/Month |
|-----------|---------|------------|
| API + Socket.io | Droplet (2 vCPU, 4GB) | ₹2,000 ($24) |
| Database | Managed PostgreSQL (1GB) | ₹1,250 ($15) |
| Cache | Managed Redis (1GB) | ₹1,250 ($15) |
| File Storage | Spaces (250GB + CDN) | ₹420 ($5) |
| Load Balancer | (when scaling) | ₹850 ($10) |
| **MVP Total** | | **~₹5,000/mo** ($60) |

**Pros:**
- **Bangalore data center** — excellent latency to Kerala
- Simplest pricing — flat monthly rates, no surprises
- Managed databases with automatic backups
- Spaces = S3-compatible storage with built-in CDN
- Excellent documentation and community
- $200 free credit for 60 days

**Cons:**
- No PostGIS on managed PostgreSQL (need to self-manage on Droplet)
- Fewer services than AWS/GCP
- Limited auto-scaling options
- No managed Redis Pub/Sub (basic Redis only)

---

### Option 4: Railway — FASTEST to Deploy

**Why**: Git push to deploy. Zero DevOps. Best for solo developer / tiny team.

| Component | Service | Cost/Month |
|-----------|---------|------------|
| API + Socket.io | Web Service (1 vCPU, 2GB) | ~₹1,500 ($18) |
| Database | PostgreSQL (built-in) | ~₹800 ($10) |
| Cache | Redis (built-in) | ~₹400 ($5) |
| **MVP Total** | | **~₹2,700/mo** ($33) |

**Pros:**
- Literally `git push` to deploy — zero config
- PostgreSQL + Redis included with one click
- Automatic HTTPS, custom domains
- Usage-based billing (pay only for what you use)
- Best developer experience of all options

**Cons:**
- **No India region** — closest is Singapore (~50-80ms latency)
- Higher latency = slightly slower real-time tracking
- Limited scaling control
- Not suitable for 10K+ concurrent users
- Socket.io connections may be less stable over longer distances

---

### Option 5: VPS (Hetzner/Contabo) + Self-Managed — CHEAPEST

**Why**: Absolute lowest cost. Full control.

| Component | Service | Cost/Month |
|-----------|---------|------------|
| Everything on one VPS | Hetzner CX31 (4 vCPU, 8GB, 80GB) | ~₹700 ($8.50) |
| Or Contabo equivalent | VPS M (6 vCPU, 16GB, 400GB) | ~₹500 ($6) |
| **Total** | | **~₹500-700/mo** |

**Pros:**
- Incredibly cheap
- Full root access
- Generous resources for the price

**Cons:**
- **No India data center** (closest: Singapore)
- You manage everything — updates, backups, security, SSL
- No managed databases — install PostgreSQL/Redis yourself
- No auto-scaling
- If server goes down at 3 AM, you fix it
- **NOT recommended for production ride-hailing app**

---

## My Recommendation: Phased Approach

### Phase 1 — MVP & Testing (Month 1-3): DigitalOcean or GCP

```
RECOMMENDED MVP SETUP:

Option A: DigitalOcean (simplest)
─────────────────────────────────
• 1x Droplet (4GB RAM)     → Node.js + Redis + Socket.io
• 1x Managed PostgreSQL    → All data
• 1x Spaces bucket         → File storage + CDN
• Cost: ~₹5,000/mo ($60)
• Free credit: $200 (covers ~3 months)

Option B: GCP (best value)
──────────────────────────
• 1x e2-medium VM          → Node.js + Redis + Socket.io
• 1x Cloud SQL PostgreSQL  → All data
• 1x Cloud Storage bucket  → File storage
• Cost: ~₹5,500/mo
• Free credit: $300 (covers ~4 months)
• Bonus: Chennai region = closest to Kerala
```

**Why not AWS for MVP?** More complex setup, higher learning curve, and GCP/DO give you free credits that cover 3-4 months of MVP testing. For a Taliparamba-scale launch (~100-200 rides/day), these are more than enough.

### Phase 2 — Kannur District (Month 4-6): Stay on GCP/DO or Migrate to AWS

```
GROWTH SETUP:

Option A: Stay on GCP/DigitalOcean (if <1,000 rides/day)
──────────────────────────────────────────────────────────
• Upgrade Droplet/VM to 4 vCPU, 8GB RAM
• Managed PostgreSQL (2GB RAM)
• Add managed Redis
• Cost: ~₹8,000-12,000/mo

Option B: AWS Mumbai (if scaling fast)
──────────────────────────────────────
• EC2 t3.medium (or ECS Fargate)  → API + Socket.io
• RDS PostgreSQL + PostGIS         → Database
• ElastiCache Redis                → Cache + real-time
• S3 + CloudFront                  → Storage + CDN
• Route 53                         → DNS
• Cost: ~₹15,000-20,000/mo
```

### Phase 3 — All Kerala (Month 10-18): AWS at Scale

```
SCALED SETUP:

• ECS Fargate (auto-scaling containers)
• RDS PostgreSQL (Multi-AZ for high availability)
• ElastiCache Redis Cluster (for real-time at scale)
• Application Load Balancer
• CloudWatch + SNS alerts
• Cost: ~₹60,000-1,00,000/mo
```

---

## Additional Services (Platform-Independent)

These services are the same regardless of where you host:

| Service | Provider | Cost/Month | Purpose |
|---------|----------|------------|---------|
| Google Maps Platform | Google | ₹10,000-50,000 | Maps, directions, geocoding, places |
| SMS/OTP | MSG91 or Twilio | ₹3,000-15,000 | OTP verification, ride alerts |
| Push Notifications | Firebase (FCM) | Free | Push notifications to riders/drivers |
| Payment Gateway | Razorpay | 2% per txn | UPI, cards, wallets |
| Error Tracking | Sentry | Free → ₹2,200 | Crash reporting |
| Email | AWS SES / Resend | ₹100-500 | Receipts, notifications |
| Domain | heyauto.in | ₹500-800/yr | Your domain name |
| SSL Certificate | Let's Encrypt / Cloudflare | Free | HTTPS |

### Google Maps API — The Big Cost to Watch

Google Maps is likely your **single biggest recurring cost**. Pricing:

| API | Free Tier | After Free Tier |
|-----|-----------|-----------------|
| Directions API | 40,000 calls/mo | $5 per 1,000 calls |
| Geocoding | 40,000 calls/mo | $5 per 1,000 calls |
| Places Autocomplete | 10,000 calls/mo | $2.83 per 1,000 calls |
| Maps JavaScript/SDK | 28,000 loads/mo | $7 per 1,000 loads |

**$200/mo free credit** from Google covers ~28K map loads + 40K direction calls. Beyond that, costs scale fast with rides.

**Cost-saving tip:** Consider **Mapbox** as an alternative ($0 for first 100K map loads/mo) or **OpenStreetMap** (free) for basic routing with **OSRM** self-hosted.

---

## Total Monthly Cost Summary

| Phase | Hosting | Maps | SMS | Other | Total |
|-------|---------|------|-----|-------|-------|
| Taliparamba MVP (free credits) | ₹0 | ₹0 (free tier) | ₹500 | ₹500 | **~₹1,000/mo** |
| Taliparamba (post-credits) | ₹5,000 | ₹0 (free tier) | ₹1,000 | ₹1,000 | **~₹7,000/mo** |
| Kannur District | ₹10,000 | ₹5,000 | ₹3,000 | ₹2,000 | **~₹20,000/mo** |
| North Kerala | ₹18,000 | ₹15,000 | ₹8,000 | ₹5,000 | **~₹46,000/mo** |
| All Kerala | ₹80,000 | ₹50,000 | ₹25,000 | ₹15,000 | **~₹1,70,000/mo** |

---

## Quick Decision Matrix

| If you are... | Choose | Why |
|---------------|--------|-----|
| Solo developer, testing idea | **Railway** | Zero config, cheapest start |
| Small team, want simplicity | **DigitalOcean** | Predictable pricing, Bangalore DC |
| Want best latency to Kerala | **GCP** | Chennai region, cheapest compute |
| Ready for production at scale | **AWS** | Mumbai region, full service suite |
| Bootstrapping on minimal budget | **VPS + self-manage** | ₹700/mo but high effort |
