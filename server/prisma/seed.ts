import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Hey Auto database for Taliparamba...\n');

  // Fare config for Taliparamba (Kerala auto govt rates)
  const fareConfig = await prisma.fareConfig.upsert({
    where: {
      city_vehicleType_effectiveFrom: {
        city: 'taliparamba',
        vehicleType: 'AUTO',
        effectiveFrom: new Date('2024-01-01'),
      },
    },
    update: {},
    create: {
      city: 'taliparamba',
      vehicleType: 'AUTO',
      baseFare: 30,
      baseDistanceKm: 1.5,
      perKmRate: 15,
      perMinRate: 1.5,
      minFare: 30,
      nightStart: '22:00',
      nightEnd: '05:00',
      nightMultiplier: 1.25,
      effectiveFrom: new Date('2024-01-01'),
    },
  });
  console.log('✓ Fare config created:', fareConfig.city);

  // Subscription plans
  const plans = [
    {
      name: 'Daily Plan',
      nameMl: 'ദിവസ പ്ലാൻ',
      durationDays: 1,
      price: 25,
      description: 'Unlimited rides for 1 day',
      descriptionMl: '1 ദിവസത്തേക്ക് അൺലിമിറ്റഡ് റൈഡുകൾ',
      city: 'taliparamba',
    },
    {
      name: 'Weekly Plan',
      nameMl: 'ആഴ്ച പ്ലാൻ',
      durationDays: 7,
      price: 150,
      description: 'Unlimited rides for 7 days — save ₹25',
      descriptionMl: '7 ദിവസത്തേക്ക് അൺലിമിറ്റഡ് റൈഡുകൾ — ₹25 ലാഭം',
      city: 'taliparamba',
    },
    {
      name: 'Monthly Plan',
      nameMl: 'മാസ പ്ലാൻ',
      durationDays: 30,
      price: 500,
      description: 'Unlimited rides for 30 days — save ₹250',
      descriptionMl: '30 ദിവസത്തേക്ക് അൺലിമിറ്റഡ് റൈഡുകൾ — ₹250 ലാഭം',
      city: 'taliparamba',
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.create({ data: plan });
    console.log(`✓ Subscription plan created: ${plan.name} (₹${plan.price})`);
  }

  // Admin user
  const admin = await prisma.user.upsert({
    where: { phone: '+919999999999' },
    update: {},
    create: {
      phone: '+919999999999',
      fullName: 'Hey Auto Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      language: 'ml',
    },
  });
  console.log('\n✓ Admin user created:', admin.phone);

  // Demo rider
  const rider = await prisma.user.upsert({
    where: { phone: '+919876543210' },
    update: {},
    create: {
      phone: '+919876543210',
      fullName: 'Demo Rider',
      role: 'RIDER',
      status: 'ACTIVE',
      language: 'ml',
    },
  });
  await prisma.riderProfile.upsert({
    where: { userId: rider.id },
    update: {},
    create: { userId: rider.id },
  });
  await prisma.wallet.upsert({
    where: { userId: rider.id },
    update: {},
    create: { userId: rider.id, balance: 500 },
  });
  console.log('✓ Demo rider created:', rider.phone);

  // Demo driver
  const driver = await prisma.user.upsert({
    where: { phone: '+919876543211' },
    update: {},
    create: {
      phone: '+919876543211',
      fullName: 'Demo Driver',
      role: 'DRIVER',
      status: 'ACTIVE',
      language: 'ml',
    },
  });
  const driverProfile = await prisma.driverProfile.upsert({
    where: { userId: driver.id },
    update: {},
    create: {
      userId: driver.id,
      licenseNumber: 'KL-01-2024-001234',
      city: 'taliparamba',
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
      currentLat: 12.0368,
      currentLng: 75.3614,
    },
  });
  await prisma.vehicle.upsert({
    where: { registrationNo: 'KL-63-A-1234' },
    update: {},
    create: {
      driverId: driverProfile.id,
      registrationNo: 'KL-63-A-1234',
      vehicleType: 'AUTO',
      make: 'Bajaj',
      model: 'RE Compact',
      year: 2022,
      fuelType: 'PETROL',
      color: 'Yellow-Black',
      seatCapacity: 3,
    },
  });
  console.log('✓ Demo driver created:', driver.phone);

  console.log('\n✅ Seed complete!\n');
  console.log('Test credentials (dev mode, OTP: 123456):');
  console.log('  Admin:  +919999999999');
  console.log('  Rider:  +919876543210');
  console.log('  Driver: +919876543211');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
