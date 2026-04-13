export const APP_CONFIG = {
  name: 'Hey Auto',
  tagline: 'Your trusted auto ride in Kerala',
  taglineMl: 'കേരളത്തിലെ നിങ്ങളുടെ വിശ്വസ്ത ഓട്ടോ യാത്ര',

  version: '1.0.0',
  apiVersion: 'v1',

  driver: {
    searchRadiusKm: 3,
    rideRequestTimeoutSec: 15,
    maxMatchingRounds: 3,
    locationUpdateIntervalMs: 3000,
    minAcceptanceRate: 50,
  },

  ride: {
    otpLength: 4,
    maxCancellationsPerDay: 3,
    routeDeviationAlertMeters: 500,
    shareLocationExpiryMin: 60,
  },

  auth: {
    otpLength: 6,
    otpExpirySec: 300,
    maxOtpAttempts: 5,
    otpCooldownSec: 30,
    accessTokenExpiryMin: 15,
    refreshTokenExpiryDays: 30,
  },

  payment: {
    currency: 'INR',
    minWalletTopup: 100,
    maxWalletTopup: 10000,
    maxWalletBalance: 50000,
  },

  rating: {
    min: 1,
    max: 5,
    defaultDriverRating: 5.0,
    defaultRiderRating: 5.0,
  },

  support: {
    phone: '+91-XXXXXXXXXX',
    email: 'support@heyauto.in',
    whatsapp: '+91-XXXXXXXXXX',
  },

  cities: [
    { id: 'taliparamba', name: 'Taliparamba', nameMl: 'തളിപ്പറമ്പ്', lat: 12.0368, lng: 75.3614, district: 'Kannur', phase: 1 },
    { id: 'kannur', name: 'Kannur', nameMl: 'കണ്ണൂർ', lat: 11.8745, lng: 75.3704, district: 'Kannur', phase: 2 },
    { id: 'payyanur', name: 'Payyanur', nameMl: 'പയ്യന്നൂർ', lat: 12.1009, lng: 75.2050, district: 'Kannur', phase: 2 },
    { id: 'thalassery', name: 'Thalassery', nameMl: 'തലശ്ശേരി', lat: 11.7471, lng: 75.4910, district: 'Kannur', phase: 2 },
    { id: 'iritty', name: 'Iritty', nameMl: 'ഇരിട്ടി', lat: 11.8680, lng: 75.5773, district: 'Kannur', phase: 2 },
    { id: 'calicut', name: 'Calicut', nameMl: 'കോഴിക്കോട്', lat: 11.2588, lng: 75.7804, district: 'Kozhikode', phase: 3 },
    { id: 'kasaragod', name: 'Kasaragod', nameMl: 'കാസർഗോഡ്', lat: 12.4996, lng: 74.9869, district: 'Kasaragod', phase: 3 },
    { id: 'kochi', name: 'Kochi', nameMl: 'കൊച്ചി', lat: 9.9312, lng: 76.2673, district: 'Ernakulam', phase: 4 },
    { id: 'thrissur', name: 'Thrissur', nameMl: 'തൃശ്ശൂർ', lat: 10.5276, lng: 76.2144, district: 'Thrissur', phase: 4 },
    { id: 'thiruvananthapuram', name: 'Thiruvananthapuram', nameMl: 'തിരുവനന്തപുരം', lat: 8.5241, lng: 76.9366, district: 'Thiruvananthapuram', phase: 4 },
    { id: 'kollam', name: 'Kollam', nameMl: 'കൊല്ലം', lat: 8.8932, lng: 76.6141, district: 'Kollam', phase: 4 },
  ],

  taliparamba: {
    center: { lat: 12.0368, lng: 75.3614 },
    radiusKm: 10,
    population: 106000,
    estimatedAutoDrivers: 600,
    keyLocations: [
      { name: 'Taliparamba Bus Stand', nameMl: 'തളിപ്പറമ്പ് ബസ് സ്റ്റാൻഡ്', lat: 12.0368, lng: 75.3614 },
      { name: 'Kannapuram Railway Station', nameMl: 'കണ്ണപുരം റെയിൽവേ സ്റ്റേഷൻ', lat: 12.0016, lng: 75.3295 },
      { name: 'Trichambaram Temple', nameMl: 'തൃച്ചംബരം ക്ഷേത്രം', lat: 12.0350, lng: 75.3580 },
      { name: 'Rajarajeshwara Temple', nameMl: 'രാജരാജേശ്വര ക്ഷേത്രം', lat: 12.0370, lng: 75.3600 },
      { name: 'Govt Hospital Taliparamba', nameMl: 'താലൂക്ക് ആശുപത്രി', lat: 12.0380, lng: 75.3620 },
      { name: 'Manna Junction', nameMl: 'മണ്ണ ജംഗ്ഷൻ', lat: 12.0400, lng: 75.3650 },
    ],
  },
} as const;
