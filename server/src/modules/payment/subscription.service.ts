// server/src/modules/payment/subscription.service.ts
// ₹25/day driver subscription via UPI — no payment gateway
// Driver pays via GPay/PhonePe → enters UTR → server verifies → goes online

import { prisma } from '../../config/database';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';

// Your UPI ID — change this to your actual UPI ID
const PLATFORM_UPI_ID = process.env.PLATFORM_UPI_ID ?? 'heyauto@ybl';
const PLATFORM_UPI_NAME = process.env.PLATFORM_UPI_NAME ?? 'Hey Auto';
const DAILY_PLAN_AMOUNT = 25;

export class SubscriptionService {

  // ─── Get or create daily plan ─────────────────
  private async getDailyPlan() {
    let plan = await prisma.subscriptionPlan.findFirst({
      where: { durationDays: 1, isActive: true },
    });

    if (!plan) {
      plan = await prisma.subscriptionPlan.create({
        data: {
          name: 'Daily Plan',
          nameMl: 'ദൈനംദിന പ്ലാൻ',
          durationDays: 1,
          price: DAILY_PLAN_AMOUNT,
          description: 'Unlimited rides for today. Zero commission.',
          descriptionMl: 'ഇന്ന് അനിയന്ത്രിതമായ യാത്രകൾ. കമ്മീഷൻ ഇല്ല.',
          isActive: true,
        },
      });
    }
    return plan;
  }

  // ─── Get current subscription status ──────────
  async getSubscriptionStatus(userId: string) {
    const profile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        subscriptions: {
          where: {
            status: 'ACTIVE',
            expiresAt: { gt: new Date() },
          },
          include: { plan: true },
          orderBy: { expiresAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!profile) throw new NotFoundError('Driver not found');

    const active = profile.subscriptions[0];

    if (active) {
      const hoursLeft = Math.ceil(
        (active.expiresAt.getTime() - Date.now()) / 3600000
      );
      return {
        hasActiveSubscription: true,
        plan: active.plan.nameMl ?? active.plan.name,
        expiresAt: active.expiresAt,
        hoursLeft,
      };
    }

    // Generate UPI deep link for GPay/PhonePe
    // Format: upi://pay?pa=UPI_ID&pn=NAME&am=AMOUNT&cu=INR&tn=NOTE
    const note = `HeyAuto-${userId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}`;
    const upiLink = `upi://pay?pa=${PLATFORM_UPI_ID}&pn=${encodeURIComponent(PLATFORM_UPI_NAME)}&am=${DAILY_PLAN_AMOUNT}&cu=INR&tn=${encodeURIComponent(note)}`;

    return {
      hasActiveSubscription: false,
      amount: DAILY_PLAN_AMOUNT,
      upiId: PLATFORM_UPI_ID,
      upiName: PLATFORM_UPI_NAME,
      upiLink,           // App opens this → launches GPay/PhonePe directly
      paymentNote: note, // Driver uses this as payment note
    };
  }

  // ─── Submit UTR after driver pays ─────────────
  // UTR = UPI Transaction Reference (12-digit number shown after payment)
  async submitUtrAndActivate(userId: string, utrNumber: string) {
    // Clean the UTR
    const utr = utrNumber.trim().toUpperCase();

    // Basic UTR validation — 12 alphanumeric characters
    if (!/^[A-Z0-9]{10,22}$/.test(utr)) {
      throw new BadRequestError(
        'Invalid UTR number. Please copy it exactly from your UPI app after payment.'
      );
    }

    // Check if this UTR was already used
    const existingPayment = await prisma.payment.findFirst({
      where: { gatewayTxnId: utr },
    });
    if (existingPayment) {
      throw new BadRequestError(
        'This UTR has already been used. Each payment can only be used once.'
      );
    }

    // Check if driver already has active subscription today
    const profile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        subscriptions: {
          where: {
            status: 'ACTIVE',
            expiresAt: { gt: new Date() },
          },
        },
      },
    });
    if (!profile) throw new NotFoundError('Driver not found');

    if (profile.subscriptions.length > 0) {
      throw new BadRequestError('You already have an active plan for today.');
    }

    const plan = await this.getDailyPlan();

    // Activate subscription — expires at midnight today (IST)
    const now = new Date();
    const startsAt = now;

    // Midnight IST = UTC+5:30, so midnight IST = 18:30 UTC previous day
    // Simpler: just set expiry to end of current day in IST
    const expiresAt = new Date();
    expiresAt.setHours(23, 59, 59, 999); // end of today local time
    // Add 5.5 hours offset for IST if server is UTC
    // Railway servers run UTC, so add 18.5 hours to get IST midnight
    const istMidnight = new Date();
    istMidnight.setUTCHours(18, 30, 0, 0); // 18:30 UTC = 00:00 IST next day
    if (istMidnight < now) {
      istMidnight.setUTCDate(istMidnight.getUTCDate() + 1);
    }

    // Create payment record (UTR as transaction ID — for record keeping)
    const payment = await prisma.payment.create({
      data: {
        payerId: userId,
        payeeId: userId, // platform receives it
        amount: DAILY_PLAN_AMOUNT,
        paymentMethod: 'UPI',
        paymentGateway: 'upi_manual',
        gatewayTxnId: utr, // store UTR here
        status: 'COMPLETED',
      },
    });

    // Create active subscription
    await prisma.driverSubscription.create({
      data: {
        driverId: profile.id,
        planId: plan.id,
        paymentId: payment.id,
        startsAt,
        expiresAt: istMidnight,
        status: 'ACTIVE',
      },
    });

    logger.info({ userId, utr, expiresAt: istMidnight }, 'Driver subscription activated via UTR');

    return {
      success: true,
      message: 'Payment verified! You can now go online.',
      messageMl: 'പേയ്‌മൻ്റ് സ്ഥിരീകരിച്ചു! ഇപ്പോൾ ഓൺലൈൻ ആകൂ.',
      expiresAt: istMidnight,
      hoursLeft: Math.ceil((istMidnight.getTime() - Date.now()) / 3600000),
    };
  }

  // ─── Get all plans ─────────────────────────────
  async getPlans() {
    return prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { durationDays: 'asc' },
    });
  }
}

export const subscriptionService = new SubscriptionService();
