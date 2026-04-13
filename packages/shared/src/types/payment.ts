export type PaymentMethod = 'CASH' | 'UPI' | 'WALLET' | 'CARD';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type TransactionType = 'CREDIT' | 'DEBIT';
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export interface Payment {
  id: string;
  rideId?: string;
  payerId: string;
  payeeId?: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentGateway?: string;
  gatewayTxnId?: string;
  status: PaymentStatus;
}

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  currency: string;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  type: TransactionType;
  amount: number;
  description?: string;
  referenceType?: string;
  referenceId?: string;
  balanceAfter: number;
  createdAt: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  nameMl?: string;
  durationDays: number;
  price: number;
  description?: string;
  descriptionMl?: string;
  maxRides?: number;
  city?: string;
}

export interface DriverSubscription {
  id: string;
  driverId: string;
  planId: string;
  startsAt: string;
  expiresAt: string;
  status: SubscriptionStatus;
  plan?: SubscriptionPlan;
}
