import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { BadRequestError, NotFoundError } from '../../utils/errors';

export class PaymentService {
  private razorpay: any;

  constructor() {
    if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
      import('razorpay').then((Razorpay) => {
        this.razorpay = new Razorpay.default({
          key_id: env.RAZORPAY_KEY_ID!,
          key_secret: env.RAZORPAY_KEY_SECRET!,
        });
      });
    }
  }

  async createOrder(userId: string, rideId: string) {
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new NotFoundError('Ride not found');
    if (ride.riderId !== userId) throw new NotFoundError('Ride not found');
    if (ride.paymentMethod === 'CASH') {
      throw new BadRequestError('Cash payments do not require an order');
    }

    if (!this.razorpay) {
      throw new BadRequestError('Payment gateway not configured');
    }

    const amount = Math.round((ride.totalAmount ?? ride.estimatedFare) * 100);

    const order = await this.razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: rideId,
      notes: { rideId, riderId: userId },
    });

    await prisma.payment.create({
      data: {
        rideId,
        payerId: userId,
        payeeId: ride.driverId ?? undefined,
        amount: amount / 100,
        paymentMethod: ride.paymentMethod,
        paymentGateway: 'razorpay',
        gatewayOrderId: order.id,
        status: 'PROCESSING',
      },
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: env.RAZORPAY_KEY_ID,
    };
  }

  async verifyPayment(userId: string, data: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    const crypto = await import('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET || '')
      .update(`${data.razorpayOrderId}|${data.razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== data.razorpaySignature) {
      throw new BadRequestError('Invalid payment signature');
    }

    const payment = await prisma.payment.findFirst({
      where: { gatewayOrderId: data.razorpayOrderId },
    });
    if (!payment) throw new NotFoundError('Payment not found');

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        gatewayTxnId: data.razorpayPaymentId,
        status: 'COMPLETED',
      },
    });

    if (payment.rideId) {
      await prisma.ride.update({
        where: { id: payment.rideId },
        data: { paymentStatus: 'COMPLETED' },
      });
    }

    logger.info({ paymentId: payment.id, rideId: payment.rideId }, 'Payment verified');

    return { status: 'COMPLETED', paymentId: payment.id };
  }

  // Wallet operations
  async getWalletBalance(userId: string) {
    let wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await prisma.wallet.create({ data: { userId } });
    }
    return { balance: wallet.balance, currency: wallet.currency };
  }

  async topUpWallet(userId: string, amount: number) {
    if (amount < 100 || amount > 10000) {
      throw new BadRequestError('Amount must be between ₹100 and ₹10,000');
    }

    let wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await prisma.wallet.create({ data: { userId } });
    }

    if (wallet.balance + amount > 50000) {
      throw new BadRequestError('Wallet balance cannot exceed ₹50,000');
    }

    const updatedWallet = await prisma.wallet.update({
      where: { userId },
      data: { balance: { increment: amount } },
    });

    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'CREDIT',
        amount,
        description: 'Wallet top-up',
        referenceType: 'topup',
        balanceAfter: updatedWallet.balance,
      },
    });

    return { balance: updatedWallet.balance };
  }

  async debitWallet(userId: string, amount: number, rideId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new BadRequestError('Wallet not found');
    if (wallet.balance < amount) throw new BadRequestError('Insufficient wallet balance');

    const updatedWallet = await prisma.wallet.update({
      where: { userId },
      data: { balance: { decrement: amount } },
    });

    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'DEBIT',
        amount,
        description: 'Ride payment',
        referenceType: 'ride',
        referenceId: rideId,
        balanceAfter: updatedWallet.balance,
      },
    });

    return { balance: updatedWallet.balance };
  }

  async getWalletTransactions(userId: string, page = 1, limit = 20) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return { data: [], total: 0, page, limit, hasMore: false };

    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);

    return {
      data: transactions,
      total,
      page,
      limit,
      hasMore: skip + transactions.length < total,
    };
  }

  async getSubscriptionPlans(city: string) {
    return prisma.subscriptionPlan.findMany({
      where: { isActive: true, OR: [{ city }, { city: null }] },
      orderBy: { price: 'asc' },
    });
  }

  async subscribeDriver(userId: string, planId: string) {
    const driver = await prisma.driverProfile.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundError('Driver profile not found');

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) throw new NotFoundError('Subscription plan not found');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    const payment = await prisma.payment.create({
      data: {
        payerId: userId,
        amount: plan.price,
        paymentMethod: 'CASH',
        status: 'COMPLETED',
      },
    });

    const subscription = await prisma.driverSubscription.create({
      data: {
        driverId: driver.id,
        planId,
        startsAt: now,
        expiresAt,
        paymentId: payment.id,
        status: 'ACTIVE',
      },
      include: { plan: true },
    });

    logger.info({ driverId: driver.id, planId }, 'Driver subscribed');
    return subscription;
  }

  async getCurrentSubscription(userId: string) {
    const driver = await prisma.driverProfile.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundError('Driver profile not found');

    return prisma.driverSubscription.findFirst({
      where: { driverId: driver.id, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      include: { plan: true },
      orderBy: { expiresAt: 'desc' },
    });
  }
}

export const paymentService = new PaymentService();
