FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --workspace=server --workspace=@heyauto/shared

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN cd server && npx prisma generate
RUN cd packages/shared && npx tsc
RUN cd server && npx tsc

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/prisma ./prisma
COPY --from=builder /app/server/node_modules ./node_modules
COPY --from=builder /app/server/package.json ./

EXPOSE 3000
CMD ["node", "dist/app.js"]
