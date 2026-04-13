FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --workspace=server --workspace=@heyauto/shared 2>/dev/null || npm install --workspace=server --workspace=@heyauto/shared

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN cd server && npx prisma generate
RUN cd packages/shared && npx tsc || true
RUN cd server && npx tsc || true

# Production
FROM base AS runner
ENV NODE_ENV=production
RUN apk add --no-cache openssl

COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/prisma ./prisma
COPY --from=builder /app/server/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/server/package.json ./

# Railway serves static files from /app/public
COPY --from=builder /app/apps/driver-console ./public/driver-console
COPY --from=builder /app/apps/demo-dashboard ./public/demo

RUN npx prisma generate

EXPOSE ${PORT:-3000}
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
