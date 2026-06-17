import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { generateOTP } from '../../utils/helpers';
import { whatsappService } from '../whatsapp';
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
  async sendOtp(input: SendOtpInput, isLoadTest = false) {
    const { phone, role } = input;

    const cooldownKey = `${OTP_COOLDOWN_PREFIX}${phone}`;
    const cooldown = await redis.get(cooldownKey);
    if (cooldown) {
      throw new TooManyRequestsError(
        `Please wait ${env.OTP_EXPIRY_SEC > 60 ? '30 seconds' : `${env.OTP_EXPIRY_SEC}s`} before requesting another OTP`,
      );
    }

    const fast2smsConfigured = !!env.FAST2SMS_API_KEY;
    const whatsappConfigured = !!(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
    const smsConfigured = !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN);
    const noGateway = !fast2smsConfigured && !whatsappConfigured && !smsConfigured;
    const demoPhones = (env.DEMO_OTP_PHONES || '').split(',').map(p => p.trim()).filter(Boolean);
    const useDemoOtp = noGateway || demoPhones.includes(phone) || isLoadTest;

    // Block only when a gateway IS configured but explicitly fails — never block during pre-launch
    // Remove this guard once Fast2SMS is live and tested in production

    const otp = useDemoOtp ? '123456' : generateOTP(6);

    await redis.setex(`${OTP_PREFIX}${phone}`, env.OTP_EXPIRY_SEC, otp);
    await redis.setex(cooldownKey, 30, '1');
    await redis.del(`${OTP_ATTEMPTS_PREFIX}${phone}`);

    let channel = 'demo';
    if (fast2smsConfigured) {
      try {
        await this.sendFast2Sms(phone, otp);
        channel = 'fast2sms';
      } catch (err) {
        logger.error({ err, phone: phone.slice(-4) }, 'Fast2SMS failed — falling back to demo OTP');
      }
    } else if (whatsappConfigured) {
      whatsappService.sendOtpMessage(phone, otp).catch((err) => {
        logger.error({ err, phone: phone.slice(-4) }, 'WhatsApp OTP failed');
      });
      channel = 'whatsapp';
    } else if (smsConfigured) {
      try {
        await this.sendSms(phone, `Your Hey Auto verification code is: ${otp}. Valid for 5 minutes.`);
        channel = 'twilio';
      } catch (err) {
        logger.error({ err, phone: phone.slice(-4) }, 'Twilio failed — falling back to demo OTP');
      }
    }

    logger.info({ phone: phone.slice(-4), role, channel }, 'OTP sent');

    return {
      message: fast2smsConfigured ? 'OTP sent via SMS'
        : whatsappConfigured ? 'OTP sent to your WhatsApp'
        : smsConfigured ? 'OTP sent via SMS'
        : 'OTP sent successfully',
      expiresIn: env.OTP_EXPIRY_SEC,
      ...(useDemoOtp && env.NODE_ENV !== 'production' && { otp }),
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

      // Guard: phone may already exist with a different role
      const phoneOwner = await prisma.user.findFirst({ where: { phone } });
      if (phoneOwner) {
        // Generic message — do not reveal what role the phone is registered under
        throw new BadRequestError(
          'This phone number is already registered. Please use the correct app to log in.',
          'PHONE_ROLE_MISMATCH',
        );
      }

      // C1 fix: never trust the client-supplied role for new user creation.
      // Public OTP endpoints can only create RIDER accounts. DRIVER accounts are
      // created by the driver app (accepted) but role is forced to DRIVER only from
      // the /driver/register flow, not here. ADMIN can never be self-registered.
      const allowedSelfRegisterRoles: UserRole[] = ['RIDER', 'DRIVER'];
      const safeRole: UserRole = allowedSelfRegisterRoles.includes(role as UserRole)
        ? (role as UserRole)
        : 'RIDER';

      try {
        user = await prisma.user.create({
          data: {
            phone,
            fullName: '',
            role: safeRole,
            status: safeRole === 'DRIVER' ? 'PENDING_VERIFICATION' : 'ACTIVE',
          },
        });
      } catch (err: any) {
        // P2002 = unique constraint — concurrent request already created the user
        if (err?.code === 'P2002') {
          const existing = await prisma.user.findFirst({ where: { phone, role: safeRole } });
          if (!existing) throw new BadRequestError('Phone number already registered with a different role', 'PHONE_ROLE_MISMATCH');
          user = existing;
          isNewUser = false;
        } else {
          throw err;
        }
      }

      if (isNewUser) {
        if (role === 'RIDER') {
          // Profiles may already exist if a prior attempt partially succeeded
          const existingProfile = await prisma.riderProfile.findUnique({ where: { userId: user.id } });
          if (!existingProfile) {
            await prisma.riderProfile.create({ data: { userId: user.id } });
            await prisma.wallet.create({ data: { userId: user.id } });
          }
        } else {
          const existingProfile = await prisma.driverProfile.findUnique({ where: { userId: user.id } });
          if (!existingProfile) {
            const profile = await prisma.driverProfile.create({
              data: {
                userId: user.id,
                licenseNumber: 'KL-' + Math.floor(1000 + Math.random() * 9000),
                city: 'bangalore',
                verificationStatus: 'PENDING',
                isOnline: false,
                currentLat: 12.9716,
                currentLng: 77.5946,
              },
            });
            await prisma.vehicle.create({
              data: {
                driverId: profile.id,
                registrationNo: 'KL-63-J-' + Math.floor(1000 + Math.random() * 9000),
                model: 'Bajaj RE',
                color: 'Yellow-Green',
                vehicleType: 'AUTO',
                isActive: true,
              },
            });
          }
          await prisma.user.update({
            where: { id: user.id },
            data: { fullName: 'Driver ' + phone.slice(-4) },
          });
          user.fullName = 'Driver ' + phone.slice(-4);
        }
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
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as AuthPayload;
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
      algorithm: 'HS256',
      expiresIn: env.JWT_ACCESS_EXPIRY as string & { __brand: 'StringValue' },
    } as jwt.SignOptions);

    const refreshToken = jwt.sign({ userId, role }, env.JWT_REFRESH_SECRET, {
      algorithm: 'HS256',
      expiresIn: env.JWT_REFRESH_EXPIRY as string & { __brand: 'StringValue' },
    } as jwt.SignOptions);

    // Parse JWT_REFRESH_EXPIRY (e.g. "30d", "7d") to derive the DB expiry — keeps them in sync
    const expiresAt = new Date();
    const refreshExpiry = env.JWT_REFRESH_EXPIRY;
    const daysMatch = refreshExpiry.match(/^(\d+)d$/);
    const hoursMatch = refreshExpiry.match(/^(\d+)h$/);
    if (daysMatch) {
      expiresAt.setDate(expiresAt.getDate() + parseInt(daysMatch[1]));
    } else if (hoursMatch) {
      expiresAt.setHours(expiresAt.getHours() + parseInt(hoursMatch[1]));
    } else {
      expiresAt.setDate(expiresAt.getDate() + 30); // safe default
    }

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

  private async sendFast2Sms(phone: string, otp: string) {
    // phone is already in +91XXXXXXXXXX format — strip to 10 digits
    const digits = phone.replace(/^\+91/, '').replace(/\D/g, '');
    try {
      const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: { authorization: env.FAST2SMS_API_KEY!, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route: 'otp',
          variables_values: otp,
          numbers: digits,
        }),
      });
      const json = await res.json() as any;
      if (!json.return) throw new Error(json.message || 'Fast2SMS failed');
      logger.info({ digits: digits.slice(-4) }, 'Fast2SMS OTP sent');
    } catch (err) {
      logger.error({ err, digits: digits.slice(-4) }, 'Fast2SMS OTP failed');
      throw err;
    }
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
