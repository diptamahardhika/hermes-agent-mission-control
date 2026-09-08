# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools for native modules (better-sqlite3 requires python/make/g++)
RUN apk add --no-cache python3 make g++

# Copy package files first for layer caching
COPY package.json package-lock.json ./

# Copy prisma schema BEFORE npm ci (postinstall needs it)
COPY prisma/schema.prisma ./prisma/

# Install all dependencies (postinstall will run prisma generate)
RUN npm ci

# Copy remaining source code and config
COPY src/ ./src/
COPY public/ ./public/
COPY next.config.ts tsconfig.json ./
COPY prisma/seed*.ts ./prisma/
COPY .env.example ./

# Generate Prisma client explicitly
RUN npx prisma generate

# Build Next.js app
ARG NEXT_PUBLIC_OWNER_NAME="Docker User"
ARG NEXT_PUBLIC_BASE_URL="http://localhost:8080"
ENV NEXT_PUBLIC_OWNER_NAME=$NEXT_PUBLIC_OWNER_NAME
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Create data directory for SQLite
RUN mkdir -p /data

# Copy package files
COPY --from=builder /app/package.json /app/package-lock.json ./

# Install only production dependencies without rebuilding native modules
RUN npm ci --only=production --ignore-scripts

# Copy ALL node_modules from builder (includes pre-compiled better-sqlite3 + Prisma client)
# This must come AFTER npm ci to preserve the generated .prisma client
COPY --from=builder /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder /app/.next/ .next/
COPY --from=builder /app/src/ src/
COPY --from=builder /app/public/ public/
COPY --from=builder /app/prisma/ prisma/
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/.env.example ./.env.example

# Start the Next.js server
EXPOSE 3000
CMD ["npm", "run", "start"]
