import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { generateOTP } from '../../utils/helpers';
import {
  BadRequestError,
  UnauthorizedError,
  TooManyRequestsError,
} from '../../utils/errors';
import type { AuthPayload } from '../../middleware/auth';
import type { SendOtpInput, VerifyOtpInput, CompleteProfileInput } from './auth.schema';

const OTP_PREFIX = 'otp:';
const OTP_ATTEMPTS_PREFIX = 'otp_attempts:';
const OTP_COOLDOWN_PREFIX = 'otp_cooldown:';

export class AuthService {
  async sendOtp(input: SendOtpInput) {
    const { phone, role } = input;

    const cooldownKey = `${OTP_COOLDOWN_PREFIX}${phone}`;
    const cooldown = await redis.get(cooldownKey);
    if (cooldown) {
      throw new TooManyRequestsError(
        `Please wait ${env.OTP_EXPIRY_SEC > 60 ? '30 seconds' : `${env.OTP_EXPIRY_SEC}s`} before requesting another OTP`,
      );
    }

    const smsConfigured = !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN);
    const useDemoOtp = !smsConfigured;
    const otp = useDemoOtp ? '123456' : generateOTP(6);

    await redis.setex(`${OTP_PREFIX}${phone}`, env.OTP_EXPIRY_SEC, otp);
    await redis.setex(cooldownKey, 30, '1');
    await redis.del(`${OTP_ATTEMPTS_PREFIX}${phone}`);

    if (!useDemoOtp) {
      await this.sendSms(phone, `Your Hey Auto verification code is: ${otp}`);
    }

    logger.info({ phone: phone.slice(-4), role, demoMode: useDemoOtp }, 'OTP sent');

    return {
      message: 'OTP sent successfully',
      expiresIn: env.OTP_EXPIRY_SEC,
      ...(useDemoOtp && { otp }),
    };
  }

  async verifyOtp(input: VerifyOtpInput) {
    const { phone, otp, role, deviceId } = input;

    const attemptsKey = `${OTP_ATTEMPTS_PREFIX}${phone}`;
    const attempts = parseInt((await redis.get(attemptsKey)) || '0');
    if (attempts >= 5) {
      throw new TooManyRequestsError('Too many failed attempts. Request a new OTP.');
    }

    const storedOtp = await redis.get(`${OTP_PREFIX}${phone}`);
    if (!storedOtp) {
      throw new BadRequestError('OTP expired. Please request a new one.', 'OTP_EXPIRED');
    }

    if (storedOtp !== otp) {
      await redis.incr(attemptsKey);
      await redis.expire(attemptsKey, env.OTP_EXPIRY_SEC);
      throw new BadRequestError('Invalid OTP', 'INVALID_OTP');
    }

    await redis.del(`${OTP_PREFIX}${phone}`);
    await redis.del(attemptsKey);

    // Look up by phone only — DB role wins (supports ADMIN login)
    let user = await prisma.user.findFirst({
      where: { phone },
    });

    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await prisma.user.create({
        data: {
          phone,
          fullName: '',
          role: role as UserRole,
          status: role === 'DRIVER' ? 'PENDING_VERIFICATION' : 'ACTIVE',
        },
      });

      if (role === 'RIDER') {
        await prisma.riderProfile.create({
          data: { userId: user.id },
        });
        await prisma.wallet.create({
          data: { userId: user.id },
        });
      } else {
        const profile = await prisma.driverProfile.create({
          data: {
            userId: user.id,
            licenseNumber: 'KL-' + Math.floor(1000 + Math.random() * 9000),
            city: 'taliparamba',
            verificationStatus: 'VERIFIED',
            isOnline: false,
            currentLat: 12.0368,
            currentLng: 75.3614,
          },
        });
        await prisma.vehicle.create({
          data: {
            driverId: profile.id,
            registrationNo: 'KL-63-J-' + Math.floor(1000 + Math.random() * 9000),
            model: 'Bajaj RE',
            color: 'Yellow-Green',
            type: 'AUTO',
            isActive: true,
          },
        });
        await prisma.user.update({
          where: { id: user.id },
          data: { fullName: 'Driver ' + phone.slice(-4), status: 'ACTIVE' },
        });
        user.fullName = 'Driver ' + phone.slice(-4);
        user.status = 'ACTIVE' as any;
      }
    }

    const tokens = await this.generateTokens(user.id, user.role, deviceId);

    logger.info({ userId: user.id, role, isNewUser }, 'User authenticated');

    return {
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        language: user.language,
        avatarUrl: user.avatarUrl,
      },
      tokens,
      isNewUser,
    };
  }

  async refreshToken(refreshToken: string) {
    let payload: AuthPayload;
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as AuthPayload;
    } catch {
      throw new UnauthorizedError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token expired or revoked', 'REFRESH_TOKEN_EXPIRED');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
      throw new UnauthorizedError('Account is not active');
    }

    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    const tokens = await this.generateTokens(user.id, user.role, storedToken.deviceId ?? undefined);

    return { tokens };
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { userId, token: refreshToken },
      });
    } else {
      await prisma.refreshToken.deleteMany({ where: { userId } });
    }
  }

  async completeProfile(userId: string, input: CompleteProfileInput) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: input.fullName,
        email: input.email,
        language: input.language,
      },
    });

    return {
      id: user.id,
      phone: user.phone,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status,
      language: user.language,
    };
  }

  private async generateTokens(userId: string, role: UserRole, deviceId?: string) {
    const accessToken = jwt.sign({ userId, role }, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRY as string & { __brand: 'StringValue' },
    } as jwt.SignOptions);

    const refreshToken = jwt.sign({ userId, role }, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRY as string & { __brand: 'StringValue' },
    } as jwt.SignOptions);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        deviceId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private async sendSms(to: string, body: string) {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
      logger.warn('Twilio not configured, skipping SMS');
      return;
    }

    try {
      const twilio = await import('twilio');
      const client = twilio.default(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        to,
        from: env.TWILIO_PHONE_NUMBER,
        body,
      });
    } catch (err) {
      logger.error({ err, to }, 'Failed to send SMS');
    }
  }
}

export const authService = new AuthService();
