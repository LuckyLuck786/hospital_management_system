# Deploying MedCore HMS

Production topology, environment configuration, and how to deploy and verify.

## Architecture

```
Browser
  │  /api/*  (same origin)
  ▼
Vercel  ── Next.js 15 frontend ──rewrite──▶  Railway  ── NestJS API ──▶ Postgres
   medcore-hms-web.vercel.app                 medcore-api-*.up.railway.app   Redis
  │
  └── WebSocket (direct) ──▶ Railway  /socket.io
```

**Live URLs**

| Layer | Host | URL |
| --- | --- | --- |
| Frontend | Vercel | https://medcore-hms-web.vercel.app |
| Backend + socket | Railway | https://medcore-api-production-b18a.up.railway.app |

### Why the backend is not on Vercel

The API needs three things serverless functions cannot provide:

1. **Socket.IO** — a persistent WebSocket server for realtime updates.
2. **BullMQ workers** — long-running background jobs (email/SMS queues).
3. **Puppeteer + headless Chromium** — full browser for PDF rendering.

So the frontend stays on Vercel (static/edge-friendly) and the backend plus both
datastores live on Railway. `apps/frontend/next.config.js` rewrites `/api/:path*`
to `API_PROXY_TARGET`, which keeps the browser same-origin and avoids CORS for REST.

## Environment variables

### Vercel (frontend)

| Name | Purpose |
| --- | --- |
| `API_PROXY_TARGET` | Railway API base URL; `/api/*` rewrites here |
| `NEXT_PUBLIC_SOCKET_URL` | Railway API base URL; the browser opens the socket here directly |

### Railway (`medcore-api`)

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Token signing |
| `PORT` | `3001` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | Allowed browser origin for CORS + socket (canonical) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Online payments |
| `RAZORPAY_WEBHOOK_SECRET` | Verifies inbound Razorpay webhooks *(optional)* |
| `PUPPETEER_CACHE_DIR` | `/app/.cache/puppeteer` — must be **under `/app`**, see below |
| `SEED_RESET` | Set to `1` for one deploy to rebuild demo data *(optional)* |

`CORS_ORIGIN` is accepted as a legacy alias for `FRONTEND_URL`; `FRONTEND_URL`
wins if both are set. A comma-separated value allows several origins.

## Deploying

### Frontend (Vercel)

Pushing to `main` auto-deploys. To deploy manually:

```bash
npx vercel deploy --prod
```

### Backend (Railway)

Railway is **not** wired to auto-deploy, so a push alone does not redeploy.
Deploy from source explicitly:

```bash
railway redeploy --from-source -y
```

> On Windows the npm-packaged Railway CLI is blocked by Application Control.
> Use the standalone release binary instead, e.g. `C:\tools\railway\railway.exe`.

Railway builds with **Railpack**, which installs Chrome's system libraries but
keeps only `/app` in the final image. That is why the root `build` script runs
`puppeteer browsers install chrome` and `PUPPETEER_CACHE_DIR` must point inside
`/app` — otherwise Puppeteer's browser is discarded and every PDF route 500s.

## Seeding

The root `start` script runs `prisma migrate deploy` → `db:seed` → `start:prod`
on every boot. The seed is **idempotent**: if appointments already exist it
skips, so restarts never duplicate demo data. To rebuild the generated demo
data (appointments, records, prescriptions, invoices, payments, lab orders),
set `SEED_RESET=1` for one deploy, then remove it. Logins, hospitals, users,
doctors, patients and medicines are preserved (they are upserts).

## Verifying a deploy

```bash
pnpm smoke
# or against another environment:
BASE_URL=https://medcore-hms-web.vercel.app node scripts/smoke.mjs
```

It checks the full chain — landing, proxy health, admin/patient login, dashboard
KPIs, invoices, Razorpay config + order creation, forged-signature rejection, and
both PDF endpoints — and exits non-zero on any failure, so it can gate a pipeline.
