# ---------- deps ----------
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev

# ---------- build ----------
FROM deps AS build

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# Generate Prisma client (build-time)
RUN npx prisma generate

# Build app
RUN npm run build

# ---------- runner ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Required for Prisma on Alpine
RUN apk add --no-cache openssl curl

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

# 🔑 CRITICAL: regenerate Prisma for runtime environment
RUN npx prisma generate

EXPOSE 3001

CMD ["node", "dist/server.js"]
