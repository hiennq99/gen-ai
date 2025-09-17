FROM node:18-alpine AS deps
WORKDIR /app
# Copy root workspace files
COPY package*.json ./
# Copy frontend specific files
COPY frontend/package*.json ./frontend/
# Copy shared workspace
COPY shared/ ./shared/
# Install all workspace dependencies
RUN npm ci

FROM node:18-alpine AS builder
WORKDIR /app

# Declare build arguments for environment variables
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL

# Set environment variables from build arguments
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend ./frontend
COPY --from=deps /app/shared ./shared
COPY --from=deps /app/package*.json ./
COPY frontend/ ./frontend/
WORKDIR /app/frontend
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the built application
COPY --from=builder --chown=nextjs:nodejs /app/frontend ./
COPY --from=builder /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["npm", "start"]