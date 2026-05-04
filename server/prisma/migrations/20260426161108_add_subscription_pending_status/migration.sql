-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'PENDING';

-- Set default status for new subscriptions
ALTER TABLE driver_subscriptions ALTER COLUMN status SET DEFAULT 'PENDING';
