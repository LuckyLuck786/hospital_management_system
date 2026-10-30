# MedCore HMS — Permissions Matrix

Generated from the `@Roles()` decorators by `scripts/gen-docs.py`, so it always matches the code.

Legend: SA Super Admin, HA Hospital Admin, DOC Doctor, NUR Nurse, REC Receptionist, LAB Lab Technician, PHA Pharmacist, ACC Accountant, PAT Patient. ✓ = allowed by RolesGuard; `public` = no login.

A ✓ for every role means any signed-in user passes the guard. Services then apply row-level rules (TenantGuard keeps everyone except SA inside their own hospital; patients only reach their own records; doctors only update their own encounters).

| Endpoint | SA | HA | DOC | NUR | REC | LAB | PHA | ACC | PAT |
|---|---|---|---|---|---|---|---|---|---|
| `GET /api/analytics/dashboard` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| `GET /api/analytics/revenue` | ✓ | ✓ |  |  |  |  |  | ✓ |  |
| `GET /api/analytics/appointment-volume` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| `GET /api/analytics/patient-growth` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| `GET /api/appointments` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /api/appointments/today` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /api/appointments/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `POST /api/appointments` |  | ✓ |  |  | ✓ |  |  |  | ✓ |
| `PATCH /api/appointments/:id/status` |  | ✓ | ✓ |  | ✓ |  |  |  |  |
| `POST /api/auth/register` | public |  |  |  |  |  |  |  |  |
| `POST /api/auth/login` | public |  |  |  |  |  |  |  |  |
| `POST /api/auth/refresh` | public |  |  |  |  |  |  |  |  |
| `POST /api/auth/verify-email` | public |  |  |  |  |  |  |  |  |
| `POST /api/auth/send-phone-otp` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `POST /api/auth/verify-phone` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `POST /api/auth/forgot-password` | public |  |  |  |  |  |  |  |  |
| `POST /api/auth/reset-password` | public |  |  |  |  |  |  |  |  |
| `POST /api/auth/logout` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /api/auth/me` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /api/departments` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /api/departments/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `POST /api/departments` | ✓ | ✓ |  |  |  |  |  |  |  |
| `PATCH /api/departments/:id` | ✓ | ✓ |  |  |  |  |  |  |  |
| `DELETE /api/departments/:id` | ✓ | ✓ |  |  |  |  |  |  |  |
| `GET /api/doctors` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /api/doctors/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /api/doctors/:id/availability` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `PATCH /api/doctors/:id/schedule` | ✓ | ✓ | ✓ |  |  |  |  |  |  |
| `GET /api/hospitals` | ✓ |  |  |  |  |  |  |  |  |
| `GET /api/hospitals/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `POST /api/hospitals` | ✓ |  |  |  |  |  |  |  |  |
| `PATCH /api/hospitals/:id` | ✓ | ✓ |  |  |  |  |  |  |  |
| `GET /api/invoices` | ✓ | ✓ |  |  | ✓ |  |  | ✓ | ✓ |
| `GET /api/invoices/:id` | ✓ | ✓ |  |  | ✓ |  |  | ✓ | ✓ |
| `PATCH /api/invoices/:id/finalize` | ✓ | ✓ |  |  | ✓ |  |  | ✓ |  |
| `POST /api/invoices/:id/pay` | ✓ | ✓ |  |  | ✓ |  |  | ✓ | ✓ |
| `GET /api/lab/catalog` | ✓ | ✓ | ✓ |  |  | ✓ |  |  |  |
| `POST /api/lab/orders` | ✓ | ✓ | ✓ |  |  |  |  |  |  |
| `GET /api/lab/orders` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |  | ✓ |
| `GET /api/lab/orders/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |  | ✓ |
| `PATCH /api/lab/orders/:id/status` | ✓ | ✓ |  |  | ✓ | ✓ |  |  |  |
| `POST /api/lab/orders/:id/results` | ✓ |  |  |  |  | ✓ |  |  |  |
| `GET /api/medical-records/patient/:patientId` |  |  | ✓ | ✓ |  |  |  |  | ✓ |
| `POST /api/medical-records/:id/attachments` |  |  | ✓ | ✓ |  |  |  |  |  |
| `GET /api/medical-records/:id/attachments/:attachmentId/url` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /api/medical-records/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `POST /api/medical-records` |  |  | ✓ |  |  |  |  |  |  |
| `PATCH /api/medical-records/:id` |  |  | ✓ |  |  |  |  |  |  |
| `GET /api/medicines` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /api/medicines/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `POST /api/medicines` | ✓ | ✓ |  |  |  |  | ✓ |  |  |
| `POST /api/medicines/:id/batches` | ✓ | ✓ |  |  |  |  | ✓ |  |  |
| `GET /api/notifications/me` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `PATCH /api/notifications/read-all` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `PATCH /api/notifications/:id/read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /api/patients` | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| `GET /api/patients/:id` | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  | ✓ |
| `GET /api/patients/:id/vaccinations` | ✓ | ✓ | ✓ | ✓ |  |  |  |  | ✓ |
| `POST /api/patients/:id/vaccinations` |  |  | ✓ | ✓ |  |  |  |  |  |
| `PATCH /api/patients/:id/family-history` |  |  | ✓ | ✓ |  |  |  |  |  |
| `GET /api/payments/config` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `POST /api/payments/orders/:invoiceId` | ✓ | ✓ |  |  | ✓ |  |  | ✓ | ✓ |
| `POST /api/payments/verify-payment` | ✓ | ✓ |  |  | ✓ |  |  | ✓ | ✓ |
| `POST /api/payments/webhook/razorpay` | public |  |  |  |  |  |  |  |  |
| `GET /api/prescriptions/:id/pdf` | ✓ | ✓ | ✓ | ✓ | ✓ |  | ✓ |  | ✓ |
| `GET /api/lab/orders/:id/pdf` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |  | ✓ |
| `GET /api/pharmacy/prescriptions/pending` | ✓ | ✓ |  |  |  |  | ✓ |  |  |
| `POST /api/pharmacy/dispense/:prescriptionId` | ✓ | ✓ |  |  |  |  | ✓ |  |  |
| `GET /api/pharmacy/low-stock` | ✓ | ✓ |  |  |  |  | ✓ |  |  |
| `POST /api/prescriptions` |  |  | ✓ |  |  |  |  |  |  |
| `GET /api/prescriptions` | ✓ | ✓ | ✓ |  |  |  |  |  |  |
| `GET /api/prescriptions/record/:medicalRecordId` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /api/prescriptions/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /api/search` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /api/users` | ✓ | ✓ |  |  | ✓ |  |  |  |  |
| `GET /api/users/me` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /api/users/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `POST /api/users` | ✓ | ✓ |  |  |  |  |  |  |  |
| `PATCH /api/users/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `DELETE /api/users/:id` | ✓ | ✓ |  |  |  |  |  |  |  |
