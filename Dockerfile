FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Build the app
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Railway injects service variables as Docker build args;
# forward them to runtime ENV so process.env can read them.
ARG RESEND_API_KEY
ARG ADMIN_EMAIL
ARG COUPON_SECRET
ENV RESEND_API_KEY=$RESEND_API_KEY
ENV ADMIN_EMAIL=$ADMIN_EMAIL
ENV COUPON_SECRET=$COUPON_SECRET

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["sh", "-c", "echo \"[env-check] COUPON_SECRET=$(test -n \"$COUPON_SECRET\" && echo SET || echo UNSET) RESEND=$(test -n \"$RESEND_API_KEY\" && echo SET || echo UNSET) ADMIN=$(test -n \"$ADMIN_EMAIL\" && echo SET || echo UNSET)\" && mkdir -p /app/data/uploads && node server.js"]
