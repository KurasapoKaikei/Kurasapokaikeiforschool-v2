# syntax=docker/dockerfile:1

# ============================================================
# クラサポ会計 — 本番コンテナ（ECS Fargate 用）
#
# node:20-slim（Debian bookworm）を使う。alpine（musl）でも動くが、
# Prisma のエンジンバイナリで環境差の事故が起きやすいため glibc 系を選ぶ。
# prisma/schema.prisma の binaryTargets に debian-openssl-3.0.x を指定済み。
#
# ビルド:  docker build -t kurasapo-kaikei:local .
# 実行:    docker run --rm -p 3000:3000 --env-file .env kurasapo-kaikei:local
# ============================================================

FROM node:20-slim AS base
# Prisma のクエリエンジンが OpenSSL を要求する
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ------------------------------------------------------------
# 依存インストール（package-lock.json のハッシュが変わらない限りキャッシュされる）
# ------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ------------------------------------------------------------
# ビルド
# ------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# DATABASE_URL はビルド時には不要（実行時に Parameter Store から注入）。
# ただし Prisma のバリデーションを通すためダミーを置く。
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN npm run build

# ------------------------------------------------------------
# 実行
# ------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 非 root で動かす
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma:
#  - prisma/ … schema と migrations（`prisma migrate deploy` をワンショットタスクで実行するため）
#  - node_modules/.prisma, @prisma … 生成済みクライアントとエンジン
#    （standalone のトレースから漏れることがあるため明示的にコピー）
#  - node_modules/prisma … migrate deploy 用の CLI
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

USER nextjs
EXPOSE 3000

# ALB のヘルスチェックとは別に、コンテナ単体の死活も見えるようにしておく
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
