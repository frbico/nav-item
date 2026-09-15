# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24-trixie-slim
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS frontend-builder
WORKDIR /app
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM ${NODE_IMAGE} AS backend-builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev

FROM ${NODE_IMAGE} AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
COPY --from=backend-builder /app/node_modules ./node_modules
COPY package.json app.js config.js db.js ./
COPY routes/ ./routes/
COPY --chown=node:node uploads/ ./uploads/
COPY --from=frontend-builder /app/dist ./web/dist
RUN mkdir -p database && chown node:node database uploads
USER node
EXPOSE 3000/tcp
CMD ["node", "app.js"]
