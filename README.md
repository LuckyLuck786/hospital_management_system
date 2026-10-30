# MedCore HMS — Hospital Management Platform

A production-grade, multi-tenant hospital management system built as a pnpm monorepo.
Implements the PRD end to end: **Phase 1 (scaffold + auth + RBAC + onboarding)**, **Phase 2
(appointments, EMR, prescriptions)**, **Phase 3 (billing, lab, pharmacy, notifications)** and
**Phase 4 (analytics dashboards, global search, integration tests, Dockerized deployment)**
with a polished, role-based frontend.

## Tech Stack

| Layer     | Technology |
|-----------|------------|
| Frontend  | Next.js 15, React 19, Tailwind CSS, TanStack Query, Zustand, lucide-react, recharts |
| Backend   | NestJS 10, Prisma ORM, Passport/JWT |
| Database  | PostgreSQL 16 (Docker) |
| Cache     | Redis 7 (Docker) |
| Language  | TypeScript (strict) across the monorepo |

## Repository Layout

```
medcore-hms-phase1/
├── apps/
│   ├── backend/            # NestJS API (port 3001)
│   │   ├── prisma/         # schema.prisma, migrations, seed.ts
│   │   └── src/            # auth, users, hospitals, departments, doctors,
│   │                       # appointments, medical-records, prescriptions,
│   │                       # patients, medicines, notifications, invoices
│   └── frontend/           # Next.js app (port 3000)
│       ├── app/            # landing, auth, /dashboard/<role> pages
│       └── components/     # shared UI kit, sidebar, header
├── packages/
│   └── types/              # shared enums/types
├── docker-compose.yml      # PostgreSQL + Redis
└── pnpm-workspace.yaml
```

## Quick Start

### 1. Prerequisites

- Node.js ≥ 20 and pnpm ≥ 9 (`corepack enable` if needed)
- Docker (for PostgreSQL + Redis)

### 2. Infrastructure

```bash
docker compose up -d          # starts PostgreSQL (5432) + Redis (6379)
```

### 3. Environment

Copy `.env.example` to `.env` (repo root) and `apps/backend/.env`:

```bash
cp .env.example .env
cp .env.example apps/backend/.env
```

Set `DATABASE_URL`, `JWT_SECRET` and `JWT_REFRESH_SECRET` (any long random strings
work in dev). The backend loads the root `.env`; the values are picked up at boot.

> **Note:** if your local Postgres container uses a different user/password than the
> example, update `DATABASE_URL` to match (e.g. `postgresql://postgres:postgres@localhost:5432/medcore_hms?schema=public`).

### 4. Database (migrate + seed)

```bash
pnpm install
cd apps/backend
npx prisma migrate deploy     # apply all migrations (incl. slot-conflict index)
npx ts-node prisma/seed.ts    # demo data: 2 hospitals, 8 doctors, 30 patients,
                              # 350+ appointments, medicines, invoices, notifications
```

### 5. Run

```bash
# Terminal 1 — backend (port 3001)
cd apps/backend && npx nest start

# Terminal 2 — frontend (port 3000)
cd apps/frontend && npx next dev
```

Open **http://localhost:3000**.

## Demo Credentials

| Role             | Email                        | Password        |
|------------------|------------------------------|-----------------|
| Super Admin      | `superadmin@medcore.com`     | `SuperAdmin@123`|
| Hospital Admin   | `admin@medcore.com`          | `Admin@123`     |
| Doctor           | `dr.rajesh.sharma@medcore.com` | `Doctor@123`  |
| Patient          | `rahul.verma@email.com`      | `Patient@123`   |
| Receptionist     | `reception@medcore.com`      | `Reception@123` |
| Nurse            | `nurse@medcore.com`          | `Nurse@123`     |
| Lab Technician   | `labtech@medcore.com`        | `LabTech@123`   |
| Pharmacist       | `pharmacist@medcore.com`     | `Pharma@123`    |
| Accountant       | `accountant@medcore.com`     | `Accountant@123`|

All 8 seeded doctors use `firstName.lastName@medcore.com` / `Doctor@123`
(e.g. `dr.priya.nair@medcore.com`). Signing in routes each role to its own dashboard.

## What's Implemented

**Backend (NestJS + Prisma)**
- JWT auth with access + refresh tokens, OTP-ready user model, cookie refresh support
- RBAC for all 9 roles with tenant (hospital) scoping on every module
- `{ success, error }` response envelope + global exception filters
- Appointments with DB-level slot-conflict protection (partial unique index),
  status workflow (PENDING → CONFIRMED → IN_PROGRESS → COMPLETED), auto invoice creation
- EMR (medical records) with vitals/BMI + prescriptions with line items
- **Lab module (Phase 3):** test catalog with gender-specific reference ranges, lab
  orders from the consultation screen, sample→processing→results→approval workflow,
  automatic abnormal-value flagging, LAB charges added to the visit invoice
- **Pharmacy module (Phase 3):** dispense queue with live stock, FIFO batch
  consumption (oldest expiry first), low-stock alerts, atomic stock decrement in a
  transaction, PHARMACY charges added at dispense time
- Patients, medicines (search + stock), notifications (in-app), invoices/payments
- Doctor/patient data scoping: doctors see only their own patients/records/schedule
- **Analytics (Phase 4):** role-aware dashboard KPIs + panels, daily revenue series,
  appointment volume, patient growth
- **Global search (Phase 4):** cross-entity search (patients, doctors, medicines,
  appointments) scoped by role and hospital
- **Integration tests (Phase 4):** 20 e2e specs — tenancy isolation, patient isolation,
  slot-conflict guard, refresh-token rotation/replay, expired-batch dispensing,
  invoice arithmetic — run against an isolated `medcore_hms_test` database
- **Deployment (Phase 4):** monorepo-aware Dockerfiles for API + web, production
  `docker-compose.yml` (postgres, redis, api, frontend, nginx), nginx reverse proxy
  config (frontend + `/api` + WebSocket upgrade headers)

**Frontend (Next.js)**
- Polished landing page + login/register
- Role-aware dashboard shell (sidebar, header with live notifications, **global search**)
- **Admin:** Recharts analytics — 30-day revenue area chart, 7-day appointment volume
  bars, department donut, low-stock alerts, recent-activity feed, real KPIs
- **Doctor:** scoped schedule + full consultation flow (vitals → notes → medicine search →
  prescription → lab test ordering → complete), patients, prescriptions, lab reports,
  pending lab-approval widget, recent-prescriptions panel
- **Patient:** book appointment, medical records, **lab reports**, prescriptions, bills
- **Lab tech:** order queue with workflow actions (collect sample → process → enter
  results → approve/reject), abnormal results flagged in red
- **Pharmacist:** prescriptions-to-dispense queue with live stock + FIFO dispensing,
  low-stock alerts, inventory table
- Receptionist: appointments (book/check-in), patient registration, billing
- Dashboards for NURSE / ACCOUNTANT roles
- Header search across patients, doctors, medicines and appointments with a debounced,
  grouped results dropdown (role-scoped)

## How to Verify Everything Works

### Backend sanity (no UI needed)

```bash
# 1. Health / auth
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dr.rajesh.sharma@medcore.com","password":"Doctor@123"}'
# → {"success":true,"data":{"accessToken":"...","user":{...}}}

# 2. Error envelope
curl http://localhost:3001/api/auth/me
# → {"success":false,"error":{"code":"UNAUTHORIZED","message":"..."}}
```

### Phase 3 walkthrough (lab + pharmacy)

1. **Doctor orders tests** — in the consultation modal, search the lab catalog
   (e.g. "blood"), pick tests, save. A lab order is created and LAB charges are added
   to the patient's invoice.
2. **Lab tech processes** — sign in as `labtech@medcore.com`, see the order queue,
   **Collect Sample → Start Processing → Enter Results**. Values outside the
   gender-specific reference range are flagged **Abnormal** automatically (e.g. enter
   HbA1c = 7.8 with reference 4.0–5.6).
3. **Approve & notify** — the tech approves; the patient and doctor receive in-app
   notifications (LAB_REPORT_READY) and the report appears in both portals.
4. **Pharmacist dispenses** — sign in as `pharmacist@medcore.com`, open **Prescriptions
   to Dispense**, click **Dispense**. Stock is consumed FIFO from the oldest batches,
   PHARMACY charges are added to the invoice, and the patient gets a
   "prescription dispensed" notification. Insufficient stock returns a friendly error.
5. **Low-stock alerts** — Dolo 650 (8 units vs reorder level 150) shows as Low stock
   in the pharmacist inventory and in `/api/pharmacy/low-stock`.

### In the UI (10-minute walkthrough)

1. **Login routing** — sign in as `admin@medcore.com`; you land on the Admin dashboard
   with real numbers (patients, doctors, today's appointments, revenue). Try each role
   from the table above — every one lands on its own dashboard.
2. **Admin → Users** — list, search, filter by role, and create a new user. The new
   user can immediately sign in.
3. **Patient booking** — sign in as `rahul.verma@email.com`, go to **Book Appointment**,
   pick a hospital, department, doctor, date and time. The same slot cannot be booked
   twice (DB-level guard returns a friendly "slot already booked" error).
4. **Doctor consultation (EMR)** — sign in as `dr.rajesh.sharma@medcore.com` →
   **Appointments** → **Consultation** on a PENDING/CONFIRMED appointment. Fill vitals
   and notes, search "Paracetamol", add the medicine, **Save Consultation**. The
   appointment moves to Completed; a medical record + prescription are created; the
   patient's invoice updates.
5. **Patient portal** — back as `rahul.verma@email.com`: **Records**, **Prescriptions**
   and **Bills** now show the consultation you just saved.
6. **Receptionist billing** — as `reception@medcore.com`, open **Billing** and mark an
   open invoice paid; the Accountant dashboard reflects it.
7. **Notifications** — the bell in the header shows in-app notifications (e.g. when an
   appointment is booked for a doctor).
8. **Slot-conflict test** — try booking the exact same doctor/date/time slot twice; the
   second booking is rejected, while a different time succeeds.

### Automated checks

```bash
cd apps/backend && npx tsc --noEmit     # backend typecheck
cd apps/frontend && npx tsc --noEmit    # frontend typecheck
cd apps/frontend && npx next build      # production build (all routes)

# Integration tests (spins up medcore_hms_test DB, runs 26 specs incl. webhooks + checkout signature verification)
cd apps/backend && npx jest --config ./test/jest-e2e.json --runInBand --forceExit
# Test Suites: 6 passed, 6 total · Tests: 26 passed, 26 total
```

The tests cover the PRD's mandatory scenarios: cross-hospital tenancy isolation,
patient data isolation, the slot double-booking guard, refresh-token rotation with
replay rejection, expired/quarantined batch protection at the pharmacy, invoice
integrity (line items sum to subtotal; subtotal − discount + tax = total), and the
Razorpay webhook (forged signatures rejected, valid payment.captured marks the invoice
PAID with a receipt notification).

## API Overview (base: `http://localhost:3001/api`)

- `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `GET /auth/me`
- `GET|POST /users`, `GET /users/:id`
- `GET|POST|PATCH /hospitals`, `GET|POST|PATCH /departments`, `GET|POST|PATCH /doctors`
- `GET|POST /patients`, `GET /patients/:id`
- `GET|POST /appointments`, `PATCH /appointments/:id/status`, `GET /appointments/today`
- `GET|POST /medical-records`, `GET /medical-records/:id`
- `GET|POST /prescriptions`, `GET /prescriptions/by-patient/:patientId`
- `GET /medicines?search=` · `GET /notifications/me` · `GET|POST /invoices`, `POST /invoices/:id/pay`
- **Lab:** `GET /lab/catalog?search=` · `POST /lab/orders` · `GET /lab/orders` ·
  `PATCH /lab/orders/:id/status` · `POST /lab/orders/:id/results`
- **Pharmacy:** `GET /pharmacy/prescriptions/pending` · `POST /pharmacy/dispense/:id` ·
  `GET /pharmacy/low-stock`
- **Analytics:** `GET /analytics/dashboard` (role-aware KPIs + panels) ·
  `GET /analytics/revenue` · `GET /analytics/appointment-volume?days=7` ·
  `GET /analytics/patient-growth?days=14`
- **Search:** `GET /search?q=` (patients, doctors, medicines, appointments — role-scoped)

## Production Deployment (Docker)

```bash
# 1. Build & start everything (postgres, redis, api, frontend, nginx)
docker compose up -d --build

# 2. Open the app through nginx
open http://localhost

# API is also exposed directly for debugging
# http://localhost:3001/api/docs   → Swagger
```

- `docker-compose.yml` — postgres + redis (persistent volumes) with healthchecks,
  API (runs `prisma migrate deploy` on boot), frontend, and an nginx reverse proxy
  that serves the Next.js app and forwards `/api/*` to NestJS.
- `apps/backend/Dockerfile` — two-stage, monorepo-aware (`pnpm deploy --prod`),
  Prisma client generated in the image.
- `apps/frontend/Dockerfile` — Next.js **standalone** output (`NEXT_OUTPUT=standalone`)
  for a slim server image; `API_PROXY_TARGET=http://api:3001` points the `/api`
  rewrites at the API container.
- `nginx/nginx.conf` — serves the frontend, proxies `/api`, and keeps WebSocket
  upgrade headers for realtime channels.

## Phase 5 — Realtime, Channels & Documents (implemented)

- **Real-time notifications (Socket.IO)** — the header bell now updates instantly:
  notifications are pushed to the logged-in user's socket (`notification:new`) the
  moment they're created, replacing 30-second polling for new events. Rooms are
  per-user and per-hospital; sockets authenticate with the JWT.
- **Background jobs (BullMQ)** — a fan-out worker dispatches EMAIL/SMS channels from
  the notification event bus; the reminder scheduler scans every 15 minutes and sends
  **24h + 1h appointment reminders** (deduped per appointment/window in Redis); the
  nightly job (01:00) raises **medicine-expiry alerts** for batches expiring within 30
  days to hospital admins + pharmacists.
- **Email (Resend) + SMS (Twilio) adapters** — when the API keys are absent they log
  the message and record the notification as undelivered; the app keeps working.
  Add the keys to `.env` and delivery switches on with no code changes.
- **PDF documents (Puppeteer)** — `GET /prescriptions/:id/pdf` and `GET /lab/orders/:id/pdf`
  render professional A4 documents with hospital letterhead, medicine/result tables,
  red abnormal flags, and a doctor signature block. Download buttons are live in the
  patient prescriptions / lab-reports pages and the doctor lab-reports page.
- **Razorpay online payments** — Standard Checkout: `POST /payments/orders/:invoiceId`
  creates a Razorpay order for the outstanding balance (min ₹1; errors from the Razorpay
  API surface as 500, auth failures as 401). The frontend opens the Razorpay modal, then
  `POST /payments/verify-payment` checks the HMAC-SHA256 signature
  (`order_id|payment_id` against the key secret) — forged or missing signatures get 400
  and are never marked paid; a valid one marks the invoice **PAID**, stores the payment id,
  and sends a PAYMENT_RECEIVED notification. The Razorpay webhook
  (`POST /payments/webhook/razorpay`) is the server-to-server fallback for settled
  payments. The patient Pay modal shows the "Pay Online with Razorpay" checkout when
  keys are configured, and falls back to counter payments otherwise.

### How to get the API keys (Phase 5)

All keys are optional — the system runs fully without them and switches on the moment
you add them to `apps/backend/.env` (copy from `.env.example`) and restart the backend.
Use **test/development keys** first; never commit real secrets.

**1. Razorpay (online payments)** — 5 minutes
1. Create a free account at https://dashboard.razorpay.com/signup
2. Dashboard → **Settings → API Keys** → **Generate Keys** (toggle **Test Mode** on top-right).
3. Copy `Key ID` → `RAZORPAY_KEY_ID`, `Key Secret` → `RAZORPAY_KEY_SECRET`.
4. **Settings → Webhooks → Add Webhook**: URL `https://<your-host>/api/payments/webhook/razorpay`
   (for local testing use a tunnel such as `ngrok http 3001`), select events
   **payment.captured** and **payment.failed**, copy the generated **Secret** →
   `RAZORPAY_WEBHOOK_SECRET`.
5. In Test Mode you can pay with the test cards/UPI shown on the checkout page — no
   real money moves.

**2. Resend (email)** — 3 minutes
1. Sign up at https://resend.com/signup (free tier includes 100 emails/day).
2. **API Keys → Create API Key** → copy into `RESEND_API_KEY`.
3. **Domains → Add Domain** and verify it; set `EMAIL_FROM=MedCore HMS <noreply@your-domain>`.
   (Without a verified domain, use `onboarding@resend.dev` as the sender for testing.)

**3. Twilio (SMS)** — 10 minutes
1. Sign up at https://www.twilio.com/try-twilio (free trial credit).
2. **Console dashboard** → copy `Account SID` → `TWILIO_ACCOUNT_SID` and `Auth Token`
   → `TWILIO_AUTH_TOKEN`.
3. **Phone Numbers → Buy a Number** (or use the trial number) → `TWILIO_PHONE_NUMBER`
   with country code, e.g. `+14155551234`.
4. In trial mode, SMS only reaches verified Caller IDs — add your own number under
   **Verified Caller IDs** for testing.

**4. PDF branding (optional)** — drop a logo/signature file on any public URL and set
`PDF_LOGO_URL` / `PDF_DOCTOR_SIGNATURE_URL`; placeholders are used otherwise.

## Phase 6 — Security hardening, storage & submission docs (implemented)

- **Audit log** — a global interceptor writes every authenticated create/update/delete to
  `AuditLog` (user, hospital, action, entity, IP, user agent). Request bodies are stored
  with passwords, tokens, OTPs and signatures redacted.
- **Encryption at rest** — `diagnosis`, `differentialDiagnosis`, `treatmentPlan` and `notes`
  on medical records are encrypted with AES-256-GCM (`FIELD_ENCRYPTION_KEY`) in a Prisma
  middleware and decrypted transparently on read. Legacy plaintext rows still read back.
- **Log sanitiser** — error logs and Sentry events never include passwords, tokens or OTPs;
  the signup OTP is emailed instead of printed.
- **Phone verification** — `POST /auth/send-phone-otp` + `POST /auth/verify-phone` (Twilio SMS).
- **Email** — Resend when `RESEND_API_KEY` is set, otherwise any SMTP server (`SMTP_URL`, e.g. Gmail).
- **Medical-record attachments** — `POST /medical-records/:id/attachments` (doctor/nurse,
  multipart `file`, max 20 MB). Extension + MIME allow-list (PDF, PNG, JPG, WEBP, TXT),
  magic-byte check to reject renamed executables, images optimised with Sharp, stored in a
  private Google Cloud Storage bucket; `GET .../attachments/:attachmentId/url` returns a
  10-minute signed URL after the same tenant/patient checks as the record itself.
- **Vaccination history** — `GET|POST /patients/:id/vaccinations` (date, vaccine, dose, batch, next due).
- **Family-history flags** — `PATCH /patients/:id/family-history` (diabetes, hypertension, cancer, cardiac).
- **Patient isolation fix** — `GET /patients/:id` now enforces hospital scoping and patient-own access.
- **Patient double-booking** — partial unique index on (patientId, date, time) for active
  appointments, next to the existing doctor-slot index.
- **Rate limits** — 100 requests / 15 min per IP on `/api/auth/*`, 1000 / 15 min elsewhere.
- **Sentry** — enabled when `SENTRY_DSN` is set (optional).
- **CI** — `.github/workflows/ci.yml`: backend typecheck + e2e (Postgres + Redis services)
  with coverage, frontend typecheck + production build, on every push and PR to `main`.

## Phase 7 — Product polish, new workspaces & security review (implemented)

**New screens**
- **Landing page** — product overview, feature grid, visit workflow, role cards, security section, live API-docs link.
- **Sign-in** — split-screen design with one-click demo accounts for all nine roles; **forgot password**,
  **reset password** (emailed link) and **verify email** (OTP + resend) screens.
- **Patient chart** (`/dashboard/patients/[id]`) — profile, allergies, insurance, family-history toggles,
  vitals trend chart, medical records with file attachments, vaccination timeline and visit history.
- **Nurse station** — triage queue with one-click *Record vitals* (BMI auto-calculated); doctors' consultation
  form pre-fills from today's triage.
- **Wards & Beds** — occupancy per department and room, admit/discharge buttons, add rooms; admin dashboard
  gets bed KPIs and a department occupancy heat map.
- **Doctor schedule editor** — weekly hours and slot length per day; doctor dashboard gets a follow-up mini calendar.
- **Pharmacy inventory** — search, low-stock and expiring filters, add medicines, receive stock batches.
- **Audit log viewer** — filter by action, expand any event to see the redacted request body.
- **Settings** — editable profile and SMS phone verification for every role.
- **Finance** — 30-day collections chart, invoice status breakdown, CSV export.
- Responsive layout with a mobile navigation drawer; per-role navigation fixed (no more links to pages a role cannot open).

**Security fixes found during the walkthrough**
- `PATCH /users/:id` let any signed-in user edit any account (and returned the password hash) — now self-or-admin only, safe fields returned.
- `GET/DELETE /users/:id` had no hospital check — now scoped.
- `PATCH /doctors/:id/schedule` let any doctor overwrite any schedule — now own schedule / same-hospital admin, with validation.
- `POST /medicines/:id/batches` accepted other hospitals' medicines and bad quantities — now scoped and validated.
- Password-reset tokens were printed to the server log instead of emailed — now emailed as a link.
- Admin "Revenue today" summed every hospital's payments — now scoped to the caller's hospital.
- Super Admin dashboards filtered on an empty hospital and showed zeros — now platform-wide.

**New API**: `GET|POST /patients/:id/vitals`, `GET /wards`, `POST /wards/rooms`,
`PATCH /wards/rooms/:id/occupancy`, `GET /audit-logs`, `POST /auth/resend-verification`.
`node dist/scripts/seed-extras.js` (or `npx ts-node src/scripts/seed-extras.ts`) adds wards, vitals and
vaccinations to an existing database idempotently.

### Tests & coverage

48 integration tests in 9 suites (`apps/backend/test`) cover every PRD mandatory scenario
plus the lab, prescription, admin, onboarding, auth, vaccination, audit and encryption flows.

```bash
cd apps/backend && npx jest --config ./test/jest-e2e.json --runInBand --coverage
# HTML report → apps/backend/coverage/index.html
```

Current coverage (backend `src/`, excluding module wiring): **76% lines, 72% statements,
78% functions**. A snapshot of the HTML report is committed in `docs/coverage/`.

### Documentation

| Document | What it covers |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Component + deployment diagrams, request flow, tenancy, caching, concurrency, security decisions |
| [docs/ER_DIAGRAM.md](docs/ER_DIAGRAM.md) | Full entity-relationship diagram generated from `schema.prisma` |
| [docs/PERMISSIONS_MATRIX.md](docs/PERMISSIONS_MATRIX.md) | Every endpoint × all 9 roles, generated from the `@Roles()` decorators |
| [docs/PROJECT_REPORT.md](docs/PROJECT_REPORT.md) | Technical decisions, challenges, deviations from the brief, lessons learned |

`python3 scripts/gen-docs.py` regenerates the ER diagram and permissions matrix.

### Deviations from the brief (documented choices)

- **Backend on Railway instead of AWS EC2/RDS/S3** — same Docker image, managed Postgres +
  Redis, zero-ops TLS. Files live in Google Cloud Storage instead of S3.
- **Razorpay only** (no Stripe) — the target market is India; Razorpay covers cards, UPI
  and netbanking. Stripe would add a second webhook path with no new behaviour.
- **No Google OAuth** — email/password + OTP covers the flows the brief requires.
- **Frontend primitives** — a small hand-built component kit on Tailwind instead of Shadcn.
