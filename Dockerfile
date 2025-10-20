# Stage 1: Dependencies
FROM node:24.10-alpine3.22 AS dependencies
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Build
FROM node:24.10-alpine3.22 AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate || true
RUN npm run build
# Verify build output exists
RUN ls -la dist/ || (echo "Build failed: dist/ directory not found" && exit 1)

# Stage 3: Runtime
FROM node:24.10-alpine3.22
WORKDIR /usr/src/app
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/prisma ./prisma
COPY package*.json ./
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]