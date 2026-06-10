FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
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
COPY --from=builder /app/package.json ./

# Copy static web apps
RUN mkdir -p ./public/driver-console ./public/demo ./public/rider
COPY --from=builder /app/public/driver-console ./public/driver-console
COPY --from=builder /app/public/rider ./public/rider
COPY --from=builder /app/apps/demo-dashboard ./public/demo
COPY --from=builder /app/public/demo.html ./public/demo.html

EXPOSE ${PORT:-3000}
CMD ["sh", "-c", "cd server && npx prisma migrate deploy && node -e \"const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.\$executeRawUnsafe('ALTER TABLE auto_stands ADD COLUMN IF NOT EXISTS radius_meters INTEGER NOT NULL DEFAULT 100').catch(()=>{}).then(()=>p.\$disconnect())\" && npx tsx src/app.ts"]
