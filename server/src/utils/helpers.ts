export function generateOTP(length = 4): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

export function generateRideOTP(): string {
  return generateOTP(4);
}

/**
 * Haversine distance between two lat/lng points in kilometers.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function isNightTime(nightStart: string, nightEnd: string): boolean {
  const now = new Date();
  // Use IST (UTC+5:30) regardless of server timezone
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  const hours = ist.getUTCHours();
  const minutes = ist.getUTCMinutes();
  const current = hours * 60 + minutes;

  const [startH, startM] = nightStart.split(':').map(Number);
  const [endH, endM] = nightEnd.split(':').map(Number);
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;

  if (start > end) {
    return current >= start || current < end;
  }
  return current >= start && current < end;
}

export function roundToRupee(amount: number): number {
  return Math.round(amount);
}
