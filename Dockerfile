# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS frontend-builder
WORKDIR /app
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:22-bookworm-slim AS backend-builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=backend-builder /app/node_modules ./node_modules
COPY package*.json app.js config.js db.js ./
COPY routes/ ./routes/
COPY uploads/ ./uploads/
COPY --from=frontend-builder /app/dist ./web/dist
RUN mkdir -p database
EXPOSE 3000/tcp
CMD ["npm", "start"]
