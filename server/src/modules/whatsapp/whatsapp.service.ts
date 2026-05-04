import Redis from 'ioredis';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { rideService } from '../ride/ride.service';
import type { MetaWebhookPayload, TwilioWhatsAppPayload } from './whatsapp.schema';

// ── Redis key prefixes ────────────────────────────────────────────────────────

const WA_STATE_PFX = 'wa_state:';   // phone → WaState
const WA_CTX_PFX   = 'wa_ctx:';    // phone → WaContext JSON
const WA_PHONE_PFX = 'wa_phone:';  // rideId → phone (for async callbacks)
const SESSION_TTL  = 30 * 60;       // 30 minutes

const DEFAULT_CITY = 'taliparamba';
const DEFAULT_LAT  = 12.0368;
const DEFAULT_LNG  = 75.3614;

// Reuse same key as ride.service (must stay in sync)
const RIDE_REQUEST_PFX = 'ride_request:';

// ── Conversation state ────────────────────────────────────────────────────────

type WaState =
  | 'IDLE'
  | 'AWAITING_PICKUP'
  | 'AWAITING_DROPOFF'
  | 'AWAITING_CONFIRM'
  | 'BOOKED';

interface WaContext {
  userId?:         string;
  name?:           string;
  pickupAddress?:  string;
  pickupLat?:      number;
  pickupLng?:      number;
  dropoffAddress?: string;
  dropoffLat?:     number;
  dropoffLng?:     number;
  estimatedFare?:  number;
  distanceKm?:     number;
  durationMin?:    number;
  rideId?:         string;
}

// ── Local place geocoder (Taliparamba / Kannur area) ─────────────────────────

interface GeoPlace { lat: number; lng: number; displayName: string }

const PLACES: Array<{ keys: string[]; place: GeoPlace }> = [
  {
    keys: ['bus stand', 'bus station', 'ബസ് സ്റ്റാൻഡ്', 'ബസ്', 'bus'],
    place: { lat: 12.0352, lng: 75.3605, displayName: 'തളിപ്പറമ്പ് ബസ് സ്റ്റാൻഡ്' },
  },
  {
    keys: ['kannapuram', 'railway', 'railway station', 'train', 'കണ്ണപുരം', 'റെയിൽവേ'],
    place: { lat: 12.0155, lng: 75.3728, displayName: 'കണ്ണപുരം റെയിൽവേ സ്റ്റേഷൻ' },
  },
  {
    keys: ['hospital', 'govt hospital', 'taluk hospital', 'ആശുപത്രി'],
    place: { lat: 12.0389, lng: 75.3622, displayName: 'ഗവ. ആശുപത്രി, തളിപ്പറമ്പ്' },
  },
  {
    keys: ['trichambaram', 'trichambaram temple', 'തൃച്ചംബരം'],
    place: { lat: 12.0521, lng: 75.3489, displayName: 'തൃച്ചംബരം ക്ഷേത്രം' },
  },
  {
    keys: ['parassinikkadavu', 'parassini', 'parassinikadavu', 'പറശ്ശിനിക്കടവ്'],
    place: { lat: 11.9752, lng: 75.3842, displayName: 'പറശ്ശിനിക്കടവ് ക്ഷേത്രം' },
  },
  {
    keys: ['manna', 'manna junction', 'മണ്ണ', 'മണ്ണ ജംഗ്ഷൻ'],
    place: { lat: 12.0428, lng: 75.3548, displayName: 'മണ്ണ ജംഗ്ഷൻ' },
  },
  {
    keys: ['kuttiyeri', 'hanging bridge', 'കുറ്റിയേരി', 'തൂക്കുപാലം'],
    place: { lat: 12.0681, lng: 75.3832, displayName: 'കുറ്റിയേരി' },
  },
  {
    keys: ['rajarajeshwara', 'rr temple', 'rr', 'temple', 'ക്ഷേത്രം', 'രാജരാജേശ്വര'],
    place: { lat: 12.0375, lng: 75.3598, displayName: 'രാജരാജേശ്വര ക്ഷേത്രം' },
  },
  {
    keys: ['school', 'school junction', 'സ്കൂൾ'],
    place: { lat: 12.0361, lng: 75.3589, displayName: 'സ്കൂൾ ജംഗ്ഷൻ' },
  },
  {
    keys: ['court', 'munsiff', 'കോടതി'],
    place: { lat: 12.0358, lng: 75.3602, displayName: 'കോടതി ജംഗ്ഷൻ' },
  },
  {
    keys: ['taliparamba', 'town', 'center', 'town center', 'തളിപ്പറമ്പ്'],
    place: { lat: 12.0368, lng: 75.3614, displayName: 'തളിപ്പറമ്പ്' },
  },
];

function geocodeText(text: string): GeoPlace | null {
  const q = text.toLowerCase().trim();
  for (const entry of PLACES) {
    if (entry.keys.some((k) => q.includes(k) || k.includes(q))) {
      return entry.place;
    }
  }
  return null;
}

// ── Malayalam message templates ───────────────────────────────────────────────

function statusLabel(status: string): string {
  const m: Record<string, string> = {
    REQUESTED:        'ഡ്രൈവർ തിരയുന്നു...',
    DRIVER_ASSIGNED:  'ഡ്രൈവർ വരുന്നു 🛺',
    DRIVER_ARRIVED:   'ഓട്ടോ എത്തി! 🏁',
    OTP_VERIFIED:     'OTP ഒക്കേ ✅',
    IN_PROGRESS:      'യാത്ര തുടരുന്നു 🚗',
    COMPLETED:        'യാത്ര പൂർത്തി ✅',
    CANCELLED_RIDER:  'ക്യാൻസൽ ചെയ്തു ❌',
    CANCELLED_DRIVER: 'ഡ്രൈവർ ക്യാൻസൽ ❌',
    NO_DRIVERS:       'ഓട്ടോ ലഭ്യമല്ല 😔',
  };
  return m[status] ?? status;
}

const M = {
  welcome: (name?: string) =>
    `🛺 *ഹേ ഓട്ടോ* — Hey Auto\n` +
    (name ? `${name}ക്ക് സ്വാഗതം! 👋\n\n` : 'സ്വാഗതം! 👋\n\n') +
    `*നിങ്ങൾക്ക് എന്ത് ചെയ്യണം?*\n` +
    `_(What do you need?)_\n\n` +
    `1️⃣  ഓട്ടോ ബുക്ക് ചെയ്യുക\n` +
    `     _(Book an Auto)_\n\n` +
    `2️⃣  ബുക്കിംഗ് സ്റ്റാറ്റസ്\n` +
    `     _(Booking Status)_\n\n` +
    `3️⃣  ക്യാൻസൽ ചെയ്യുക\n` +
    `     _(Cancel Ride)_\n\n` +
    `ഒരു നമ്പർ ടൈപ്പ് ചെയ്ത് അയക്കൂ 👆`,

  askPickup: () =>
    `📍 *നിങ്ങൾ ഇപ്പോൾ എവിടെ ആണ്?*\n` +
    `_(Where are you now?)_\n\n` +
    `*ഉദാഹരണം:*\n` +
    `• തളിപ്പറമ്പ് ബസ് സ്റ്റാൻഡ്\n` +
    `• Govt Hospital\n` +
    `• Manna Junction\n` +
    `• Railway Station\n\n` +
    `ടൈപ്പ് ചെയ്ത് അയക്കൂ ✍️`,

  askDropoff: (pickup: string) =>
    `✅ *${pickup}*\n\n` +
    `🎯 *നിങ്ങൾ എവിടെ പോകണം?*\n` +
    `_(Where do you want to go?)_\n\n` +
    `*ഉദാഹരണം:*\n` +
    `• കണ്ണപുരം Railway Station\n` +
    `• Parassinikkadavu\n` +
    `• Trichambaram Temple\n\n` +
    `ടൈപ്പ് ചെയ്ത് അയക്കൂ ✍️`,

  confirmRide: (pickup: string, dropoff: string, fare: number, dist: number, dur: number) =>
    `🛺 *ഓട്ടോ ബുക്കിംഗ് വിവരം*\n\n` +
    `📍 From: *${pickup}*\n` +
    `🎯 To:     *${dropoff}*\n\n` +
    `💰 ഫെയർ: *₹${fare}*\n` +
    `📏 ദൂരം:  *${dist.toFixed(1)} km*\n` +
    `⏱️ സമയം: *~${dur} min*\n\n` +
    `*ബുക്ക് ചെയ്യണോ?*\n\n` +
    `✅ *YES* — ഉണ്ടെ, ബുക്ക് ചെയ്യൂ\n` +
    `❌ *NO*  — ഇല്ല, ക്യാൻസൽ`,

  searching: () =>
    `⏳ *ഓട്ടോ തിരയുന്നു...*\n` +
    `_(Searching for auto)_\n\n` +
    `ഒരു മിനിറ്റ് ദയവായി കാത്തിരിക്കൂ 🙏\n` +
    `_(Please wait a moment)_`,

  driverAssigned: (driverName: string, vehicle: string, phone: string) =>
    `✅ *ഓട്ടോ ലഭിച്ചു!*\n` +
    `_(Auto found!)_\n\n` +
    `👨 ഡ്രൈവർ: *${driverName}*\n` +
    `🛺 വണ്ടി:  *${vehicle}*\n` +
    `📞 ഫോൺ:   *${phone}*\n\n` +
    `ഓട്ടോ വരുന്ന സമയം ദയവായി കാത്തിരിക്കൂ 🙏`,

  driverArrived: (otp: string) =>
    `🏁 *ഓട്ടോ എത്തി!*\n` +
    `_(Auto has arrived!)_\n\n` +
    `ഡ്രൈവർക്ക് ഈ OTP കൊടുക്കൂ:\n\n` +
    `🔢 *${otp}*\n\n` +
    `⚠️ _ഈ OTP മറ്റ് ആർക്കും കൊടുക്കരുത്_\n` +
    `_(Do not share this OTP with anyone else)_`,

  rideStarted: () =>
    `🚗 *യാത്ര ആരംഭിച്ചു!*\n` +
    `_(Ride started!)_\n\n` +
    `സുരക്ഷിതമായ യാത്ര ആശംസിക്കുന്നു 🙏`,

  rideCompleted: (fare: number) =>
    `✅ *യാത്ര പൂർത്തിയായി!*\n` +
    `_(Ride completed!)_\n\n` +
    `💰 *₹${fare}* — ഫെയർ\n\n` +
    `ഹേ ഓട്ടോ ഉപയോഗിച്ചതിന് നന്ദി! 🛺\n` +
    `_(Thank you for using Hey Auto!)_\n\n` +
    `_1 — പുതിയ ഓട്ടോ ബുക്ക് ചെയ്യുക_`,

  rideCancelled: (by: string) =>
    `❌ *ഓട്ടോ ക്യാൻസൽ ആയി*\n` +
    (by === 'DRIVER' ? '_(Driver cancelled the ride)_\n\n' : '_(Ride cancelled)_\n\n') +
    `_1 — വീണ്ടും ഓട്ടോ ബുക്ക് ചെയ്യുക_`,

  noDrivers: () =>
    `😔 *ഇപ്പോൾ ഓട്ടോ ലഭ്യമല്ല*\n` +
    `_(No auto available right now)_\n\n` +
    `കുറച്ചു സമയം കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കൂ 🙏\n\n` +
    `_1 — വീണ്ടും ശ്രമിക്കുക_`,

  cancelledOk: () =>
    `❌ *ക്യാൻസൽ ചെയ്തു*\n\n` +
    `_1 — പുതിയ ഓട്ടോ ബുക്ക് ചെയ്യുക_`,

  status: (s: string, rideId: string) =>
    `📊 *നിലവിലെ ബുക്കിംഗ്*\n\n` +
    `🎫 Ride: \`${rideId.slice(-8).toUpperCase()}\`\n` +
    `📍 Status: *${statusLabel(s)}*\n\n` +
    `_3 — ക്യാൻസൽ ചെയ്യുക_`,

  noActiveRide: () =>
    `ℹ️ *ഇപ്പോൾ ഒരു ബുക്കിംഗ് ഇല്ല*\n` +
    `_(No active booking)_\n\n` +
    `_1 — ഓട്ടോ ബുക്ക് ചെയ്യുക_`,

  unknownPlace: (text: string) =>
    `❓ *"${text}"* — ഈ സ്ഥലം കണ്ടെത്താൻ കഴിഞ്ഞില്ല\n` +
    `_(Place not found)_\n\n` +
    `ഇതിൽ ഒന്ന് ടൈപ്പ് ചെയ്യൂ:\n\n` +
    `• Bus Stand\n• Hospital\n• Railway Station\n` +
    `• Manna Junction\n• Trichambaram\n• Parassinikkadavu\n\n` +
    `_0 — Main Menu_`,

  error: () =>
    `⚠️ ഒരു error ഉണ്ടായി. ദയവായി വീണ്ടും ശ്രമിക്കൂ.\n` +
    `_(An error occurred. Please try again.)_\n\n` +
    `_0 — Main Menu_`,
};

// ── State helpers ─────────────────────────────────────────────────────────────

async function getState(phone: string): Promise<WaState> {
  const s = await redis.get(`${WA_STATE_PFX}${phone}`);
  return (s as WaState) ?? 'IDLE';
}

async function setState(phone: string, state: WaState): Promise<void> {
  await redis.setex(`${WA_STATE_PFX}${phone}`, SESSION_TTL, state);
}

async function getCtx(phone: string): Promise<WaContext> {
  const raw = await redis.get(`${WA_CTX_PFX}${phone}`);
  return raw ? (JSON.parse(raw) as WaContext) : {};
}

async function setCtx(phone: string, ctx: WaContext): Promise<void> {
  await redis.setex(`${WA_CTX_PFX}${phone}`, SESSION_TTL, JSON.stringify(ctx));
}

async function clearSession(phone: string): Promise<void> {
  await redis.del(`${WA_STATE_PFX}${phone}`, `${WA_CTX_PFX}${phone}`);
}

// ── WhatsApp send abstraction ─────────────────────────────────────────────────

async function sendMessage(to: string, text: string): Promise<void> {
  const metaReady = !!(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
  const twilioReady = !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER);

  if (metaReady) {
    await sendViaMeta(to, text);
  } else if (twilioReady) {
    await sendViaTwilio(to, text);
  } else {
    // Dev mode: log to console
    logger.info({ to, text }, '[WhatsApp DEV] outgoing message');
  }
}

async function sendViaMeta(to: string, text: string): Promise<void> {
  const version = env.WHATSAPP_API_VERSION ?? 'v19.0';
  const url = `https://graph.facebook.com/${version}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: text },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    logger.error({ to, status: res.status, err }, 'Meta WhatsApp send failed');
  }
}

async function sendViaTwilio(to: string, text: string): Promise<void> {
  try {
    const twilio = await import('twilio');
    const client = twilio.default(env.TWILIO_ACCOUNT_SID!, env.TWILIO_AUTH_TOKEN!);
    await client.messages.create({
      from: `whatsapp:${env.TWILIO_PHONE_NUMBER}`,
      to: `whatsapp:${to}`,
      body: text,
    });
  } catch (err) {
    logger.error({ err, to }, 'Twilio WhatsApp send failed');
  }
}

// ── User identity ─────────────────────────────────────────────────────────────
// Normalise WhatsApp number to bare Indian mobile (no +91 prefix)

function normalisePhone(raw: string): string {
  // Twilio format: whatsapp:+919876543210
  const clean = raw.replace(/^whatsapp:\+?/, '').replace(/^\+/, '');
  // Strip country code 91 if present and number is 12 digits
  if (clean.length === 12 && clean.startsWith('91')) return clean.slice(2);
  return clean;
}

async function findOrCreateRider(phone: string, name: string): Promise<string> {
  let user = await prisma.user.findFirst({ where: { phone, role: 'RIDER' } });

  if (!user) {
    user = await prisma.user.create({
      data: { phone, fullName: name || `WA ${phone.slice(-4)}`, role: 'RIDER', status: 'ACTIVE' },
    });
    await prisma.riderProfile.create({ data: { userId: user.id } });
    await prisma.wallet.create({ data: { userId: user.id } });
    logger.info({ phone, userId: user.id }, 'WhatsApp: created new rider');
  } else if (!user.fullName && name) {
    await prisma.user.update({ where: { id: user.id }, data: { fullName: name } });
  }

  return user.id;
}

// ── Core bot logic ────────────────────────────────────────────────────────────

async function processMessage(
  rawPhone: string,
  name: string,
  text: string,
  location?: { lat: number; lng: number; address?: string },
): Promise<void> {
  const phone = normalisePhone(rawPhone);
  const cmd = text.trim().toLowerCase();

  // Global shortcuts — work from any state
  if (['0', 'menu', 'hi', 'hello', 'help', 'start', 'ഹേ', 'ഹലോ'].includes(cmd)) {
    await clearSession(phone);
    await sendMessage(rawPhone, M.welcome(name));
    return;
  }

  if (['3', 'cancel', 'ക്യാൻസൽ', 'no'].includes(cmd)) {
    const ctx = await getCtx(phone);
    if (ctx.rideId) {
      try {
        const ride = await prisma.ride.findUnique({ where: { id: ctx.rideId } });
        if (ride && ['REQUESTED', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVED'].includes(ride.status)) {
          await rideService.cancelRide(ctx.userId!, ctx.rideId, { reason: 'Cancelled via WhatsApp' }, 'RIDER');
          logger.info({ rideId: ctx.rideId, phone }, 'WhatsApp: ride cancelled');
        }
      } catch (err) {
        logger.error({ err, phone }, 'WhatsApp: cancel failed');
      }
    }
    await clearSession(phone);
    await sendMessage(rawPhone, M.cancelledOk());
    return;
  }

  const state = await getState(phone);

  // ── IDLE ──────────────────────────────────────────────────────────────────
  if (state === 'IDLE') {
    if (['1', 'book', 'ബുക്ക്', 'auto', 'ഓട്ടോ'].includes(cmd)) {
      await setState(phone, 'AWAITING_PICKUP');
      await sendMessage(rawPhone, M.askPickup());
    } else if (['2', 'status', 'സ്റ്റാറ്റസ്'].includes(cmd)) {
      await sendMessage(rawPhone, M.noActiveRide());
    } else {
      await sendMessage(rawPhone, M.welcome(name));
    }
    return;
  }

  // ── AWAITING_PICKUP ────────────────────────────────────────────────────────
  if (state === 'AWAITING_PICKUP') {
    let geo: GeoPlace | null = null;
    let displayAddress = text.trim();

    if (location) {
      geo = { lat: location.lat, lng: location.lng, displayName: location.address ?? 'Current Location' };
      displayAddress = geo.displayName;
    } else {
      geo = geocodeText(text);
      if (geo) displayAddress = geo.displayName;
    }

    if (!geo) {
      await sendMessage(rawPhone, M.unknownPlace(text.trim()));
      return;
    }

    const ctx: WaContext = {
      pickupAddress: displayAddress,
      pickupLat:     geo.lat,
      pickupLng:     geo.lng,
    };
    await setCtx(phone, ctx);
    await setState(phone, 'AWAITING_DROPOFF');
    await sendMessage(rawPhone, M.askDropoff(displayAddress));
    return;
  }

  // ── AWAITING_DROPOFF ───────────────────────────────────────────────────────
  if (state === 'AWAITING_DROPOFF') {
    let geo: GeoPlace | null = null;
    let displayAddress = text.trim();

    if (location) {
      geo = { lat: location.lat, lng: location.lng, displayName: location.address ?? 'Destination' };
      displayAddress = geo.displayName;
    } else {
      geo = geocodeText(text);
      if (geo) displayAddress = geo.displayName;
    }

    if (!geo) {
      await sendMessage(rawPhone, M.unknownPlace(text.trim()));
      return;
    }

    const ctx = await getCtx(phone);

    // Guard: same place
    if (geo.lat === ctx.pickupLat && geo.lng === ctx.pickupLng) {
      await sendMessage(rawPhone, `❗ Pickup, drop-off ഒരേ സ്ഥലമാണ്. _(Same place)_ — drop-off വ്യത്യസ്തമായി ടൈപ്പ് ചെയ്യൂ.`);
      return;
    }

    ctx.dropoffAddress = displayAddress;
    ctx.dropoffLat     = geo.lat;
    ctx.dropoffLng     = geo.lng;

    // Get fare estimate
    try {
      const estimate = await rideService.getFareEstimate({
        pickupLat:   ctx.pickupLat!,
        pickupLng:   ctx.pickupLng!,
        dropoffLat:  geo.lat,
        dropoffLng:  geo.lng,
        city:        DEFAULT_CITY,
      });
      ctx.estimatedFare = estimate.totalFare;
      ctx.distanceKm    = estimate.distanceKm;
      ctx.durationMin   = estimate.durationMin;
    } catch {
      ctx.estimatedFare = 40;
      ctx.distanceKm    = 2;
      ctx.durationMin   = 8;
    }

    await setCtx(phone, ctx);
    await setState(phone, 'AWAITING_CONFIRM');
    await sendMessage(rawPhone, M.confirmRide(
      ctx.pickupAddress!,
      displayAddress,
      ctx.estimatedFare!,
      ctx.distanceKm!,
      ctx.durationMin!,
    ));
    return;
  }

  // ── AWAITING_CONFIRM ───────────────────────────────────────────────────────
  if (state === 'AWAITING_CONFIRM') {
    if (['yes', 'y', 'ok', 'okay', 'ഉണ്ടെ', 'ഉണ്ട്', 'ശരി', '1'].includes(cmd)) {
      const ctx = await getCtx(phone);
      await setState(phone, 'BOOKED');
      await sendMessage(rawPhone, M.searching());

      try {
        const userId = await findOrCreateRider(phone, name);
        ctx.userId = userId;

        const ride = await rideService.requestRide(userId, {
          pickupLat:      ctx.pickupLat!,
          pickupLng:      ctx.pickupLng!,
          pickupAddress:  ctx.pickupAddress!,
          dropoffLat:     ctx.dropoffLat!,
          dropoffLng:     ctx.dropoffLng!,
          dropoffAddress: ctx.dropoffAddress!,
          paymentMethod:  'CASH',
          city:           DEFAULT_CITY,
        });

        ctx.rideId = ride.id;
        await setCtx(phone, ctx);
        // Map rideId → whatsapp phone for async callbacks
        await redis.setex(`${WA_PHONE_PFX}${ride.id}`, 3600, rawPhone);

        logger.info({ rideId: ride.id, phone }, 'WhatsApp: ride requested');
      } catch (err) {
        logger.error({ err, phone }, 'WhatsApp: requestRide failed');
        await clearSession(phone);
        await sendMessage(rawPhone, M.error());
      }
    } else {
      // Any non-yes response → cancel and reset
      await clearSession(phone);
      await sendMessage(rawPhone, M.cancelledOk());
    }
    return;
  }

  // ── BOOKED (waiting for driver) ────────────────────────────────────────────
  if (state === 'BOOKED') {
    if (['2', 'status'].includes(cmd)) {
      const ctx = await getCtx(phone);
      if (ctx.rideId) {
        const ride = await prisma.ride.findUnique({ where: { id: ctx.rideId } }).catch(() => null);
        if (ride) {
          await sendMessage(rawPhone, M.status(ride.status, ride.id));
          return;
        }
      }
    }
    await sendMessage(rawPhone, `⏳ ഡ്രൈവർ തിരയുന്നു...\n_(Searching for driver)_\n\n_3 — ക്യാൻസൽ ചെയ്യുക_`);
    return;
  }

  // Fallback
  await sendMessage(rawPhone, M.welcome(name));
}

// ── Public service class ──────────────────────────────────────────────────────

export class WhatsAppService {
  private rideEventSub: Redis | null = null;

  /** Verify Meta webhook challenge */
  verifyWebhook(query: Record<string, string>): string | null {
    const mode     = query['hub.mode'];
    const token    = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
      logger.info('WhatsApp webhook verified');
      return challenge;
    }
    logger.warn({ mode, token }, 'WhatsApp webhook verification failed');
    return null;
  }

  /** Handle Meta Cloud API webhook POST */
  async handleMetaWebhook(payload: MetaWebhookPayload): Promise<void> {
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;
        const { messages, contacts } = change.value;
        if (!messages?.length) continue;

        for (const msg of messages) {
          if (msg.type === 'text' && msg.text?.body) {
            const contactName = contacts?.find((c) => c.wa_id === msg.from)?.profile.name ?? '';
            await processMessage(msg.from, contactName, msg.text.body).catch((err) =>
              logger.error({ err, from: msg.from }, 'WhatsApp: processMessage error'),
            );
          } else if (msg.type === 'location' && msg.location) {
            const contactName = contacts?.find((c) => c.wa_id === msg.from)?.profile.name ?? '';
            await processMessage(msg.from, contactName, msg.location.address ?? 'Current Location', {
              lat:     msg.location.latitude,
              lng:     msg.location.longitude,
              address: msg.location.address,
            }).catch((err) => logger.error({ err, from: msg.from }, 'WhatsApp: location error'));
          } else if (msg.type === 'interactive' && msg.interactive) {
            const reply =
              msg.interactive.button_reply?.id ??
              msg.interactive.list_reply?.id ??
              msg.interactive.button_reply?.title ??
              msg.interactive.list_reply?.title ??
              '';
            const contactName = contacts?.find((c) => c.wa_id === msg.from)?.profile.name ?? '';
            await processMessage(msg.from, contactName, reply).catch((err) =>
              logger.error({ err, from: msg.from }, 'WhatsApp: interactive error'),
            );
          }
        }
      }
    }
  }

  /** Handle Twilio WhatsApp webhook POST (form-encoded body) */
  async handleTwilioWebhook(payload: TwilioWhatsAppPayload): Promise<void> {
    const rawPhone = payload.From; // "whatsapp:+919876543210"
    const name     = payload.ProfileName ?? '';
    const body     = payload.Body ?? '';

    if (payload.Latitude && payload.Longitude) {
      await processMessage(rawPhone, name, body || 'Current Location', {
        lat: parseFloat(payload.Latitude),
        lng: parseFloat(payload.Longitude),
      }).catch((err) => logger.error({ err, from: rawPhone }, 'WhatsApp Twilio: location error'));
    } else {
      await processMessage(rawPhone, name, body).catch((err) =>
        logger.error({ err, from: rawPhone }, 'WhatsApp Twilio: processMessage error'),
      );
    }
  }

  /**
   * Subscribe to ride_events and forward status updates to WhatsApp users.
   * Call once at server startup.
   */
  setupRideEventListener(): void {
    this.rideEventSub = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });

    this.rideEventSub.subscribe('ride_events', (err) => {
      if (err) {
        logger.error({ err }, 'WhatsApp: failed to subscribe ride_events');
        return;
      }
      logger.info('WhatsApp: subscribed to ride_events');
    });

    this.rideEventSub.on('message', (_channel, raw) => {
      this.handleRideEvent(raw).catch((err) =>
        logger.error({ err }, 'WhatsApp: ride event handler error'),
      );
    });
  }

  private async handleRideEvent(raw: string): Promise<void> {
    let event: Record<string, any>;
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }

    const { type, rideId } = event;
    if (!rideId) return;

    // Look up the WhatsApp phone that owns this ride
    const rawPhone = await redis.get(`${WA_PHONE_PFX}${rideId}`);
    if (!rawPhone) return; // Not a WhatsApp ride

    const phone = normalisePhone(rawPhone);

    switch (type) {
      case 'ride:driver_assigned': {
        const vehicle = [event.vehicleColor, event.vehicleModel, event.vehicleRegistrationNo]
          .filter(Boolean)
          .join(' • ');
        await sendMessage(rawPhone, M.driverAssigned(
          event.driverName ?? 'Driver',
          vehicle || 'Auto',
          event.driverPhone ?? '',
        ));
        break;
      }

      case 'ride:driver_arrived': {
        await sendMessage(rawPhone, M.driverArrived(event.rideOtp ?? ''));
        break;
      }

      case 'ride:started': {
        await sendMessage(rawPhone, M.rideStarted());
        break;
      }

      case 'ride:completed': {
        await sendMessage(rawPhone, M.rideCompleted(event.totalAmount ?? event.actualFare ?? 0));
        await clearSession(phone);
        await redis.del(`${WA_PHONE_PFX}${rideId}`);
        break;
      }

      case 'ride:cancelled': {
        const by = event.cancelledBy === 'DRIVER' ? 'DRIVER' : 'RIDER';
        await sendMessage(rawPhone, M.rideCancelled(by));
        await clearSession(phone);
        await redis.del(`${WA_PHONE_PFX}${rideId}`);
        break;
      }

      case 'ride:no_drivers': {
        await sendMessage(rawPhone, M.noDrivers());
        await clearSession(phone);
        await redis.del(`${WA_PHONE_PFX}${rideId}`);
        break;
      }
    }
  }

  async sendOtpMessage(phone: string, otp: string): Promise<void> {
    const text =
      `🔐 *Aye Auto OTP*\n\n` +
      `Your verification code is:\n\n` +
      `*${otp}*\n\n` +
      `Valid for 5 minutes. Do not share this with anyone.\n` +
      `_(ഈ OTP ആർക്കും കൊടുക്കരുത്)_`;
    await sendMessage(phone, text);
  }
}

export const whatsappService = new WhatsAppService();
