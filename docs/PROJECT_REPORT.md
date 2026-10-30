# MedCore HMS — Project Report

**Project:** MedCore HMS, a multi-tenant Hospital Management Platform
**Type:** Individual full-stack project (4 weeks)
**Repository:** https://github.com/LuckyLuck786/hospital_management_system
**Live demo:** https://medcore-hms-web.vercel.app · API docs: https://medcore-api-production-b18a.up.railway.app/api/docs

---

## 1. Summary

MedCore HMS digitises the outpatient journey of a multi-branch hospital: registration,
appointment booking, the doctor's encounter (vitals, diagnosis, prescription, lab orders),
laboratory processing, pharmacy dispensing, billing with online payment, and notifications.
All nine roles from the brief (Super Admin, Hospital Admin, Doctor, Nurse, Receptionist,
Lab Technician, Pharmacist, Accountant, Patient) have their own dashboard and API permissions.

The system is a pnpm monorepo:

- `apps/backend` — NestJS 10, Prisma 5, PostgreSQL 16, Redis 7, BullMQ, Socket.IO, Puppeteer.
- `apps/frontend` — Next.js 15 (App Router), React 19, Tailwind, TanStack Query, Zustand, Recharts.
- `packages/types` — enums and API types shared by both apps.

It is deployed with the frontend on Vercel and the API, database and Redis on Railway, with
medical-record files in Google Cloud Storage. 48 integration tests run against a real
Postgres database in CI and cover 74% of backend lines.

## 2. Requirements coverage

| PRD area | Delivered |
| --- | --- |
| Week 1 — scaffold, schema, auth, RBAC, onboarding | Monorepo, Docker Compose, 30-model Prisma schema with 5 migrations, JWT + rotating refresh tokens, email OTP, phone OTP, 9-role guard, hospital onboarding/verification, departments, doctor profiles |
| Week 2 — appointments, EMR, prescriptions | Weekly doctor schedules, slot computation, DB-enforced double-booking protection for doctors and patients, full status lifecycle incl. EMERGENCY and NO_SHOW, EMR with vitals/BMI/ICD-10/allergies/treatment plan, vaccinations, family history, attachments, prescriptions with PDF export |
| Week 3 — lab, pharmacy, billing, notifications | Lab catalog with gender-specific ranges, sample→processing→results→approval workflow with abnormal flags and PDF; FIFO pharmacy with expiry quarantine, low-stock alerts and nightly expiry job; invoices aggregated across consultation/lab/pharmacy; Razorpay checkout + signed webhook; in-app (Socket.IO), email and SMS notifications with 24 h and 1 h reminders |
| Week 4 — dashboards, search, tests, deployment | Role dashboards with Recharts (revenue, volume, growth, departments, low stock, activity), global search, 37 e2e tests, coverage report, CI, Dockerfiles + nginx, live deployment, seeded demo data, Swagger |

Out of scope per the brief and not built: video consultation, DICOM, AI diagnostics,
native mobile apps, HL7/FHIR.

## 3. Architecture

Full diagrams are in `docs/ARCHITECTURE.md`. The short version:

- **Browser → Vercel → Railway.** The Next.js app rewrites `/api/*` to the API, so REST
  calls are same-origin and need no CORS. The browser opens the Socket.IO connection to
  the API directly, authenticated with the access token.
- **Request pipeline.** Helmet → rate limit → CORS → `JwtAuthGuard` → `RolesGuard` →
  `TenantGuard` → `ValidationPipe` → service → Prisma. On the way out, `AuditInterceptor`
  logs writes and `TransformInterceptor` wraps the result in the standard envelope.
- **Background work** runs in BullMQ workers inside the API process: reminder scans every
  15 minutes, a nightly expiry scan, and a notifications queue whose worker fans each event
  out to email and SMS independently, so a failed SMS does not stop the email.

NestJS modules map one-to-one to the brief's feature areas (Auth, Users, Hospitals,
Departments, Doctors, Patients, Appointments, MedicalRecords, Prescriptions, Lab, Pharmacy,
Medicines, Invoices, Payments, Notifications, Analytics, Search, PDF, Storage, Jobs, Realtime).
Cross-cutting services (Prisma, Redis, Email/SMS channels, Storage) are global modules, so
feature modules do not import each other and there are no circular dependencies.

## 4. Technical decisions

### 4.1 Row-level multi-tenancy

I compared database-per-tenant, schema-per-tenant and row-level tenancy. The first two
isolate data physically but multiply migrations and make the Super Admin's cross-hospital
analytics expensive. For 30- to 800-bed hospitals on one SaaS deployment, row-level tenancy
with a `hospitalId` on every hospital-owned table gives one migration path and one
connection pool.

The risk is a missing filter. I handle it in three layers: `TenantGuard` pins the
request to the caller's hospital, services re-check `hospitalId` on every record fetched by
id, and patients are additionally limited to their own rows. The tenancy and patient-isolation
tests run in CI on every push. While writing the final tests I found that `GET /patients/:id`
skipped the service-level check and let any signed-in user read any patient profile. The fix
and a regression test are part of the final commit. That bug is the reason the PRD tells you
to write isolation tests on day one.

### 4.2 Booking concurrency

The brief asks for either `SELECT … FOR UPDATE` or optimistic concurrency. I used a third
option that is stronger than both for this case: **partial unique indexes**. One covers
`(doctorId, scheduledDate, scheduledTime)` and one covers `(patientId, scheduledDate, scheduledTime)`,
both limited to active statuses. When two requests race for one slot, Postgres accepts one
insert and rejects the other with a unique violation, which the API returns as
`409 SLOT_UNAVAILABLE`. There are no explicit locks to hold while the invoice and
notifications are created, and the guarantee holds across several API instances. Cancelled,
no-show and completed appointments drop out of the index, so their slots free up
automatically. The e2e suite fires two bookings for the same slot in parallel and asserts exactly one wins (201) and the other gets 409.

### 4.3 Authentication and sessions

Access tokens live 15 minutes. Refresh tokens live 7 days, sit in an `httpOnly`,
`SameSite=Strict` cookie and are stored in Redis under `rt:{userId}:{deviceId}`. Each refresh
issues a new token and deletes the old key, so a stolen refresh token works at most once.
A test replays a rotated token and expects 401. Per-device keys make "log out of this device"
and "log out everywhere" a single Redis delete. Passwords use bcrypt with cost 12. Signup
sends a 6-digit email OTP, and signed-in users can verify their phone by SMS OTP.

### 4.4 Clinical data protection

- **Encryption at rest.** Diagnosis, differential diagnosis, treatment plan and notes are
  encrypted with AES-256-GCM in a Prisma middleware before they reach Postgres, and decrypted
  on read. Ciphertext carries a version prefix (`enc:v1:`), so existing plaintext rows keep
  working and the key can be rotated later. I chose application-level encryption over
  `pgcrypto` because the key never reaches the database server or its backups.
- **Append-only records.** Medical records have no delete endpoint. Only the attending
  doctor (or a hospital admin) can amend one.
- **Audit trail.** Every authenticated write is logged with user, hospital, action, entity,
  IP and user agent. The request body is stored with secrets redacted.
- **Attachments.** Files go to a private Google Cloud Storage bucket after an extension +
  MIME allow-list, a magic-byte check (so a renamed `.exe` is rejected) and a 20 MB limit.
  Images are re-encoded with Sharp. Reads go through 10-minute signed URLs issued only after
  the same tenant and patient checks as the record. I validate file type and content instead
  of running ClamAV, which keeps the container small and blocks executables outright.

### 4.5 Data model choices

- **Doctor availability** is a weekly template (`weeklySchedule` JSON) rather than
  pre-generated slot rows. A doctor edits one week, not hundreds of rows. Free slots for a
  date are computed and cached in Redis for 60 seconds, and the cache is cleared on every
  booking or status change.
- **Prescription items** carry dosage, frequency, duration and instructions, because those
  differ per medicine within one prescription.
- **Lab results** are structured values. Reference ranges are copied from the catalog when the
  order is placed, so editing the catalog later never changes a historical report.
- **Pharmacy stock** is tracked per batch. Dispensing consumes the earliest-expiring batch first
  inside one transaction and refuses expired or quarantined stock.
- **Soft deletes** (`deletedAt`) on patients, doctors and appointments keep history intact.

### 4.6 Payments

Razorpay Standard Checkout: the API creates an order for the invoice balance, the browser
opens the Razorpay modal, and the API verifies the HMAC-SHA256 signature before marking the
invoice PAID. The signed webhook is a server-to-server fallback. Client-side "success" is
never trusted, and tests cover forged signatures and the webhook. Stripe was left out because
Razorpay already covers cards, UPI and netbanking for the Indian market.

## 5. Testing

| Layer | Tooling | What is covered |
| --- | --- | --- |
| Integration (API) | Jest + Supertest against a real Postgres + Redis | 48 tests in 9 suites |
| Live smoke | `scripts/smoke.mjs` against Vercel → Railway | 12 checks: landing, proxy, logins, dashboards, invoices, Razorpay order, forged signature, lab and prescription PDFs |

All six mandatory scenarios from the brief are automated:

1. A doctor cannot read another hospital's records (`tenancy.e2e-spec.ts`).
2. A patient cannot read another patient's records or profile (`tenancy`, `patients`).
3. Two simultaneous bookings for one slot: exactly one succeeds (`appointments`).
4. A rotated refresh token cannot be reused (`auth`).
5. Expired stock cannot be dispensed (`pharmacy`).
6. Invoice total equals the sum of its line items (`invoices`).

The other suites walk the lab workflow, prescriptions, analytics, admin management, hospital
onboarding, registration with OTP, password reset, vaccinations, audit logging, encryption at
rest and the Razorpay webhook. Backend coverage is **76% of lines, 72% of statements and 78% of
functions** (HTML report in `docs/coverage/`). Branch coverage (43%) is the weakest number,
mostly defensive error branches in PDF rendering and job processors.

Frontend component tests (Vitest) and browser E2E (Playwright) were not written. The live smoke
script and the API suites cover the same journeys at the HTTP level.

## 6. Deployment and operations

- **CI.** GitHub Actions runs the backend typecheck and the full e2e suite with coverage
  against Postgres and Redis service containers, and runs a frontend typecheck and production
  build, on every push and pull request to `main`.
- **Containers.** Two-stage, monorepo-aware Dockerfiles. The API image runs
  `prisma migrate deploy` before starting, so schema changes ship with the code.
- **Hosting.** Vercel serves the frontend. Railway runs the API image with managed Postgres
  and Redis on a private network. Google Cloud Storage holds attachments.
- **Configuration.** Every variable is listed in `.env.example`. Optional integrations
  (email, SMS, Sentry, storage) are switched off cleanly when their keys are missing, so
  the app always boots.

The brief names AWS EC2, RDS and S3. Railway and GCS give the same building blocks with
TLS, backups and no server maintenance, which fits a solo four-week project. The Compose
file plus env vars run unchanged on an EC2 instance if needed.

## 7. Challenges and how they were solved

1. **CORS and WebSockets in production.** REST worked but realtime failed, because the API
   and the socket gateway read different env vars for the allowed origin. One shared
   `allowedOrigins()` helper now feeds both, and the smoke test checks the deployed chain.
2. **Headless Chrome on a PaaS.** Puppeteer needs a Chrome binary that matches the build
   platform. The image installs Chrome into a fixed cache directory at build time, and
   the browser instance is reused across requests.
3. **Double-booking under concurrency.** Application checks alone failed under parallel
   requests. Moving the rule into partial unique indexes made it impossible to break.
4. **A tenancy hole found late.** The patient profile endpoint trusted the guard alone.
   Writing broader tests surfaced it, which reinforced the lesson below.
5. **Authorization gaps found by walking the UI as each role.** A full click-through as all nine roles
   surfaced endpoints that trusted the guard alone: any user could edit any account, any doctor could
   overwrite any schedule, and stock could be added to another hospital's medicines. Each now checks
   ownership in the service, with an e2e test per case (`test/security.e2e-spec.ts`).
6. **Invalid payment keys in production.** The smoke test caught Razorpay rejecting the
   deployed key (401) before any user did. Swapping to a valid test key fixed it with no code change.

## 8. Lessons learned

- Write isolation tests first and keep them in CI. They found a real leak.
- Push invariants into the database (unique indexes, foreign keys, transactions) rather
  than relying on service code alone.
- A short smoke test against the live deployment is worth more than many unit tests when
  the failure is configuration, not code.
- Design the permission matrix before coding endpoints. Generating it from the decorators
  (`scripts/gen-docs.py`) keeps the documentation honest.
- Make every external integration optional at boot. The app stays usable while keys are
  missing, and turning a feature on is a config change.

## 9. Known limitations and next steps

- Frontend component tests (Vitest) and Playwright journeys.
- Insurance/TPA claim workflow beyond storing the insurer and policy number.
- Bed-level patient assignment (beds are tracked as counts per room).
- Doctor signature as an uploaded image (currently a rendered signature block).
- Google OAuth and Stripe, if the product expands beyond India.

## 10. Demo credentials

| Role | Email | Password |
| --- | --- | --- |
| Super Admin | superadmin@medcore.com | SuperAdmin@123 |
| Hospital Admin | admin@medcore.com | Admin@123 |
| Doctor | dr.rajesh.sharma@medcore.com | Doctor@123 |
| Nurse | nurse@medcore.com | Nurse@123 |
| Receptionist | reception@medcore.com | Reception@123 |
| Lab Technician | labtech@medcore.com | LabTech@123 |
| Pharmacist | pharmacist@medcore.com | Pharma@123 |
| Accountant | accountant@medcore.com | Accountant@123 |
| Patient | rahul.verma@email.com | Patient@123 |
