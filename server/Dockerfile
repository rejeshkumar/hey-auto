FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
# Works whether Railway builds from repo root OR server/ subdirectory
COPY package*.json ./
# If server/package.json exists (root context), copy it; otherwise we're already in server context
COPY server/package.json ./server/package.json 2>/dev/null || true
RUN npm install --legacy-peer-deps 2>/dev/null || (cd .. && npm install --legacy-peer-deps)

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN cd server && npx prisma generate

FROM base AS runner
ENV NODE_ENV=production
RUN apk add --no-cache openssl

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server ./server
COPY --from=builder /app/package.json ./

# Copy static web apps
RUN mkdir -p ./public/driver-console ./public/demo ./public/rider
COPY --from=builder /app/public/driver-console ./public/driver-console 2>/dev/null || true
COPY --from=builder /app/public/rider ./public/rider 2>/dev/null || true
COPY --from=builder /app/apps/demo-dashboard ./public/demo 2>/dev/null || true
COPY --from=builder /app/public/demo.html ./public/demo.html 2>/dev/null || true

EXPOSE ${PORT:-3000}
CMD ["sh", "-c", "cd server && npx prisma migrate deploy && npx tsx src/app.ts"]
