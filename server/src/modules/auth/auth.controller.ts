import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import type { SendOtpInput, VerifyOtpInput, RefreshTokenInput, CompleteProfileInput } from './auth.schema';

export class AuthController {
  async sendOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.sendOtp(req.body as SendOtpInput);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.verifyOtp(req.body as VerifyOtpInput);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body as RefreshTokenInput;
      const result = await authService.refreshToken(refreshToken);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      await authService.logout(req.user!.userId, refreshToken);
      res.json({ success: true, data: { message: 'Logged out successfully' } });
    } catch (err) {
      next(err);
    }
  }

  async completeProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.completeProfile(
        req.user!.userId,
        req.body as CompleteProfileInput,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
