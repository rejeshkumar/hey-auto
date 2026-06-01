// server/src/modules/payment/subscription.service.ts
// ₹25/day driver subscription — Cashfree Payment Links (auto-activate on webhook)
// Falls back to manual UTR flow if CASHFREE_APP_ID / CASHFREE_SECRET_KEY are not set.

import crypto from 'crypto';
import { prisma } from '../../config/database';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { notificationService } from '../notification/notification.service';

const PLATFORM_UPI_ID = process.env.PLATFORM_UPI_ID ?? 'heyauto@ybl';
const PLATFORM_UPI_NAME = process.env.PLATFORM_UPI_NAME ?? 'Hey Auto';
const DAILY_PLAN_AMOUNT = 25;

// Cashfree config — undefined when not configured
const CF_APP_ID = process.env.CASHFREE_APP_ID;
const CF_SECRET = process.env.CASHFREE_SECRET_KEY;
const CF_ENV = process.env.CASHFREE_ENV ?? 'sandbox'; // 'sandbox' | 'production'
const CF_BASE =
  CF_ENV === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

export const cashfreeEnabled = !!(CF_APP_ID && CF_SECRET);

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

  // ─── IST midnight helper ──────────────────────
  private istMidnight(): Date {
    const d = new Date();
    d.setUTCHours(18, 30, 0, 0); // 18:30 UTC = 00:00 IST next day
    if (d < new Date()) d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }

  // ─── Get current subscription status ──────────
  async getSubscriptionStatus(userId: string) {
    const profile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'PENDING'] } },
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!profile) throw new NotFoundError('Driver not found');

    const latest = profile.subscriptions[0];

    if (latest?.status === 'PENDING') {
      return {
        hasActiveSubscription: false,
        pendingApproval: true,
        cashfreeEnabled,
        message: cashfreeEnabled
          ? 'Payment pending. Please complete payment in your browser.'
          : 'Payment submitted. Waiting for admin approval (2–4 hrs).',
        messageMl: cashfreeEnabled
          ? 'പേയ്‌മൻ്റ് ബ്രൗസറിൽ പൂർത്തിയാക്കൂ.'
          : 'പേയ്‌മൻ്റ് സമർപ്പിച്ചു. അഡ്മിൻ അംഗീകാരം കാത്തിരിക്കുന്നു.',
      };
    }

    if (latest?.status === 'ACTIVE' && latest.expiresAt > new Date()) {
      const hoursLeft = Math.ceil(
        (latest.expiresAt.getTime() - Date.now()) / 3600000,
      );
      return {
        hasActiveSubscription: true,
        plan: latest.plan.nameMl ?? latest.plan.name,
        expiresAt: latest.expiresAt,
        hoursLeft,
        cashfreeEnabled,
      };
    }

    // No active subscription — return UPI details for fallback
    const note = `HeyAuto-${userId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}`;
    const upiLink = `upi://pay?pa=${PLATFORM_UPI_ID}&pn=${encodeURIComponent(PLATFORM_UPI_NAME)}&am=${DAILY_PLAN_AMOUNT}&cu=INR&tn=${encodeURIComponent(note)}`;
    return {
      hasActiveSubscription: false,
      cashfreeEnabled,
      amount: DAILY_PLAN_AMOUNT,
      upiId: PLATFORM_UPI_ID,
      upiName: PLATFORM_UPI_NAME,
      upiLink,
      paymentNote: note,
    };
  }

  // ─── Create Cashfree Payment Link ─────────────
  async createCashfreeOrder(userId: string, planId?: string) {
    if (!cashfreeEnabled) {
      throw new BadRequestError('Cashfree is not configured. Use UTR payment instead.');
    }

    // Prevent duplicate pending orders
    const profile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        subscriptions: {
          where: {
            status: { in: ['ACTIVE', 'PENDING'] },
            expiresAt: { gt: new Date() },
          },
          take: 1,
        },
        user: true,
      },
    });
    if (!profile) throw new NotFoundError('Driver not found');
    if (profile.subscriptions.length > 0) {
      throw new BadRequestError('You already have an active or pending subscription.');
    }

    const plan = planId
      ? await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
      : await this.getDailyPlan();
    if (!plan) throw new NotFoundError('Plan not found');

    // Unique link ID: heyauto-sub-<8 chars of userId>-<timestamp>
    const linkId = `heyauto-sub-${userId.slice(0, 8)}-${Date.now()}`;
    const phone = profile.user.phone.replace(/^\+91/, '').replace(/\D/g, '');

    const payload = {
      link_id: linkId,
      link_amount: plan.price,
      link_currency: 'INR',
      link_purpose: `Hey Auto ${plan.name}`,
      customer_details: {
        customer_id: userId.slice(0, 32),
        customer_phone: phone,
        customer_name: profile.user.phone, // name not stored separately
      },
      link_notify: { send_sms: false, send_email: false },
      link_meta: {
        return_url: `heyauto://subscription/return?link_id=${linkId}`,
        upi_intent: true,
      },
    };

    const cfRes = await fetch(`${CF_BASE}/links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': CF_APP_ID!,
        'x-client-secret': CF_SECRET!,
      },
      body: JSON.stringify(payload),
    });

    if (!cfRes.ok) {
      const err = await cfRes.text();
      logger.error({ linkId, err }, 'Cashfree link creation failed');
      throw new BadRequestError('Payment gateway error. Please try again.');
    }

    const cfData = await cfRes.json() as { link_url: string };

    // Create payment + pending subscription
    const payment = await prisma.payment.create({
      data: {
        payerId: userId,
        payeeId: userId,
        amount: plan.price,
        paymentMethod: 'UPI',
        paymentGateway: 'cashfree',
        gatewayTxnId: linkId,
        status: 'PENDING',
      },
    });

    await prisma.driverSubscription.create({
      data: {
        driverId: profile.id,
        planId: plan.id,
        paymentId: payment.id,
        startsAt: new Date(),
        expiresAt: this.istMidnight(),
        status: 'PENDING',
      },
    });

    logger.info({ userId, linkId, planId: plan.id }, 'Cashfree payment link created');

    return { paymentUrl: cfData.link_url, linkId, amount: plan.price };
  }

  // ─── Handle Cashfree Webhook ──────────────────
  async handleCashfreeWebhook(rawBody: string, signature: string, timestamp: string) {
    if (!CF_SECRET) throw new BadRequestError('Cashfree not configured');

    // Verify HMAC-SHA256 signature
    const signedPayload = timestamp + rawBody;
    const expected = crypto
      .createHmac('sha256', CF_SECRET)
      .update(signedPayload)
      .digest('base64');

    if (expected !== signature) {
      logger.warn({ expected, signature }, 'Cashfree webhook signature mismatch');
      throw new BadRequestError('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody) as {
      type: string;
      data?: { link?: { link_id?: string; link_status?: string }; payment?: { cf_payment_id?: string } };
    };

    logger.info({ type: event.type }, 'Cashfree webhook received');

    // Handle payment link success
    if (event.type === 'PAYMENT_LINK_EVENT') {
      const linkStatus = event.data?.link?.link_status;
      const linkId = event.data?.link?.link_id;
      const cfPaymentId = event.data?.payment?.cf_payment_id?.toString();

      if (linkStatus !== 'PAID' || !linkId) return { received: true };

      await this.activateByLinkId(linkId, cfPaymentId);
    }

    return { received: true };
  }

  private async activateByLinkId(linkId: string, cfPaymentId?: string) {
    const payment = await prisma.payment.findFirst({
      where: { gatewayTxnId: linkId, paymentGateway: 'cashfree' },
      include: {
        driverSubscription: { include: { driver: { include: { user: true } } } },
      },
    });

    if (!payment) {
      logger.warn({ linkId }, 'No payment found for Cashfree link');
      return;
    }
    if (payment.status === 'COMPLETED') {
      logger.info({ linkId }, 'Cashfree webhook duplicate — already activated');
      return;
    }

    const sub = payment.driverSubscription;
    if (!sub) {
      logger.warn({ linkId }, 'No subscription linked to payment');
      return;
    }

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          gatewayTxnId: cfPaymentId ?? linkId,
        },
      }),
      prisma.driverSubscription.update({
        where: { id: sub.id },
        data: {
          status: 'ACTIVE',
          expiresAt: this.istMidnight(),
        },
      }),
    ]);

    // Push notification to driver
    try {
      const userId = sub.driver.userId;
      await notificationService.sendPushNotification(
        userId,
        'Subscription Activated!',
        'Your subscription is now active. You can go online and accept rides.',
        { type: 'SUBSCRIPTION_ACTIVATED' },
      );
    } catch (e) {
      logger.warn({ error: e }, 'Failed to send subscription push notification');
    }

    logger.info({ linkId, subId: sub.id }, 'Driver subscription auto-activated via Cashfree');
  }

  // ─── Submit UTR after manual UPI payment ──────
  async submitUtrAndActivate(userId: string, utrNumber: string) {
    const utr = utrNumber.trim().toUpperCase();
    if (!/^[A-Z0-9]{10,22}$/.test(utr)) {
      throw new BadRequestError(
        'Invalid UTR number. Please copy it exactly from your UPI app after payment.',
      );
    }

    const existingPayment = await prisma.payment.findFirst({
      where: { gatewayTxnId: utr },
    });
    if (existingPayment) {
      throw new BadRequestError(
        'This UTR has already been used. Each payment can only be used once.',
      );
    }

    const profile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
        },
      },
    });
    if (!profile) throw new NotFoundError('Driver not found');
    if (profile.subscriptions.length > 0) {
      throw new BadRequestError('You already have an active plan for today.');
    }

    const plan = await this.getDailyPlan();

    const payment = await prisma.payment.create({
      data: {
        payerId: userId,
        payeeId: userId,
        amount: DAILY_PLAN_AMOUNT,
        paymentMethod: 'UPI',
        paymentGateway: 'upi_manual',
        gatewayTxnId: utr,
        status: 'PENDING',
      },
    });

    await prisma.driverSubscription.create({
      data: {
        driverId: profile.id,
        planId: plan.id,
        paymentId: payment.id,
        startsAt: new Date(),
        expiresAt: this.istMidnight(),
        status: 'PENDING',
      },
    });

    logger.info({ userId, utr }, 'Driver subscription UTR submitted — pending admin approval');

    return {
      success: true,
      message: 'Payment submitted! Admin will verify your UTR within 2–4 hours.',
      messageMl: 'പേയ്‌മൻ്റ് സമർപ്പിച്ചു! 2–4 മണിക്കൂറിനുള്ളിൽ അഡ്മിൻ UTR പരിശോധിക്കും.',
      pendingApproval: true,
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
