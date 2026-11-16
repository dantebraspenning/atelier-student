# syntax=docker/dockerfile:1
# Production image: Next.js standalone server + migration script. Requires DATABASE_URL etc. (see .env.example).

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=deps /app/node_modules/postgres ./node_modules/postgres
COPY --from=deps /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY docker-entrypoint.sh ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
