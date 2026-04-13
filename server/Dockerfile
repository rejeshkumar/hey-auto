FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY packages/shared/package.json ./packages/shared/
RUN npm install --legacy-peer-deps

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN cd server && npx prisma generate

FROM base AS runner
ENV NODE_ENV=production
RUN apk add --no-cache openssl

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server ./server
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package.json ./

COPY --from=builder /app/apps/driver-console ./public/driver-console
COPY --from=builder /app/apps/demo-dashboard ./public/demo

EXPOSE ${PORT:-3000}
CMD ["sh", "-c", "cd server && npx prisma db push --accept-data-loss && npx tsx src/app.ts"]
