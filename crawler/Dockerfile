# Build context: raíz del repo (docker build -f crawler/Dockerfile .)
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY crawler/package.json ./crawler/
RUN npm ci --omit=dev -w crawler 2>/dev/null || (cd crawler && npm ci --omit=dev)

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY crawler/package.json crawler/tsconfig.json ./crawler/
COPY lib ./lib
COPY crawler/src ./crawler/src
COPY crawler/scripts ./crawler/scripts
RUN cd crawler && npm ci && npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production TZ=Europe/Madrid
RUN npx playwright install-deps chromium && npx playwright install chromium
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/crawler/node_modules ./crawler/node_modules
COPY --from=build /app/crawler/dist ./crawler/dist
COPY --from=build /app/lib ./lib
COPY crawler/package.json ./crawler/
WORKDIR /app/crawler
CMD ["npx", "tsx", "src/index.ts"]
