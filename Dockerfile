# Multi-stage Production Dockerfile for Blood Donation & Emergency Assistance Platform

# Stage 1: Build & Dependencies
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json* bun.lock* ./
RUN npm ci

# Copy Prisma schema and generate Prisma client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source code and build TypeScript
COPY . .
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies only
COPY package.json package-lock.json* bun.lock* ./
RUN npm ci --omit=dev

# Copy generated Prisma engine & client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma

# Copy built application output
COPY --from=builder /app/dist ./dist

EXPOSE 5000

# Run database migrations and start server
CMD ["node", "dist/src/server.js"]
