#!/usr/bin/env node
/**
 * Live end-to-end smoke test for the deployed MedCore HMS.
 *
 * Exercises the real production chain: browser origin (Vercel) → /api rewrite →
 * NestJS (Railway) → Postgres/Redis. Run it after any deploy:
 *
 *   node scripts/smoke.mjs
 *   BASE_URL=https://medcore-hms-web.vercel.app node scripts/smoke.mjs
 *
 * Exits non-zero if any check fails, so it can gate a deploy pipeline.
 */

const BASE = (process.env.BASE_URL || 'https://medcore-hms-web.vercel.app').replace(/\/$/, '');
const ADMIN = { email: 'admin@medcore.com', password: 'Admin@123' };
const PATIENT = { email: 'rahul.verma@email.com', password: 'Patient@123' };

let passed = 0;
let failed = 0;

function ok(name, detail = '') {
  passed++;
  console.log(`  \u001b[32mPASS\u001b[0m ${name}${detail ? ` — ${detail}` : ''}`);
}
function bad(name, detail = '') {
  failed++;
  console.log(`  \u001b[31mFAIL\u001b[0m ${name}${detail ? ` — ${detail}` : ''}`);
}

/** Perform a request and return {status, json|bytes, headers}. */
async function call(method, path, { token, body, binary = false } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const buf = Buffer.from(await res.arrayBuffer());
  if (binary) return { status: res.status, bytes: buf };
  let json;
  try {
    json = JSON.parse(buf.toString('utf8'));
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

const first = (v) => (Array.isArray(v) ? v[0] : v?.items?.[0] ?? v?.data?.[0]);
const asArray = (v) => (Array.isArray(v) ? v : v?.items ?? v?.data ?? []);

async function login(creds) {
  const { status, json } = await call('POST', '/api/auth/login', { body: creds });
  return { status, token: json?.data?.accessToken, user: json?.data?.user };
}

async function main() {
  console.log(`\nMedCore HMS smoke test \u2192 ${BASE}\n`);

  // 1. Public frontend + proxy health
  const landing = await call('GET', '/');
  landing.status === 200 ? ok('frontend landing', 'HTTP 200') : bad('frontend landing', `HTTP ${landing.status}`);

  const unauth = await call('GET', '/api/auth/me');
  unauth.status === 401
    ? ok('api reachable through proxy', 'unauthenticated /auth/me → 401')
    : bad('api reachable through proxy', `HTTP ${unauth.status} (expected 401)`);

  // 2. Auth
  const admin = await login(ADMIN);
  admin.token
    ? ok('admin login', `role=${admin.user?.role ?? '?'}`)
    : bad('admin login', `HTTP ${admin.status}`);

  const patient = await login(PATIENT);
  patient.token ? ok('patient login') : bad('patient login', `HTTP ${patient.status}`);

  if (!admin.token || !patient.token) return;

  // 3. Authed read paths
  const me = await call('GET', '/api/auth/me', { token: patient.token });
  me.status === 200 && me.json?.data?.patient?.id
    ? ok('patient profile', 'has patient record')
    : bad('patient profile', `HTTP ${me.status}`);

  const dash = await call('GET', '/api/analytics/dashboard', { token: admin.token });
  const kpis = dash.json?.data?.kpis;
  dash.status === 200 && kpis
    ? ok('admin dashboard', `patients=${kpis.patientsTotal} doctors=${kpis.doctorsTotal}`)
    : bad('admin dashboard', `HTTP ${dash.status}`);

  // 4. Billing + Razorpay checkout
  const invoices = await call('GET', '/api/invoices', { token: patient.token });
  const invList = asArray(invoices.json?.data);
  invList.length ? ok('patient invoices', `${invList.length} rows`) : bad('patient invoices', `HTTP ${invoices.status}`);

  const cfg = await call('GET', '/api/payments/config', { token: patient.token });
  cfg.json?.data?.configured
    ? ok('online payments configured', `keyId=${cfg.json.data.keyId}`)
    : bad('online payments configured', JSON.stringify(cfg.json?.data));

  const payable = invList.find((i) => String(i.status).toUpperCase() === 'FINALIZED') ?? first(invList);
  if (payable) {
    const order = await call('POST', `/api/payments/orders/${payable.id}`, { token: patient.token });
    order.status === 201 && order.json?.data?.orderId
      ? ok('razorpay order created', order.json.data.orderId)
      : bad('razorpay order created', `HTTP ${order.status} ${JSON.stringify(order.json?.error ?? '')}`);
  }

  const forged = await call('POST', '/api/payments/verify-payment', {
    token: patient.token,
    body: { orderId: 'order_fake', paymentId: 'pay_fake', signature: 'deadbeef' },
  });
  forged.status === 400
    ? ok('forged signature rejected', 'HTTP 400')
    : bad('forged signature rejected', `HTTP ${forged.status} (expected 400)`);

  // 5. PDF generation (Puppeteer/Chrome must exist in the runtime image)
  const labOrders = await call('GET', '/api/lab/orders', { token: patient.token });
  const labOrder = first(labOrders.json?.data);
  if (labOrder) {
    const pdf = await call('GET', `/api/lab/orders/${labOrder.id}/pdf`, { token: patient.token, binary: true });
    pdf.bytes.subarray(0, 4).toString() === '%PDF'
      ? ok('lab report PDF', `${pdf.bytes.length} bytes`)
      : bad('lab report PDF', `HTTP ${pdf.status}`);
  }

  const pid = me.json?.data?.patient?.id;
  const records = await call('GET', `/api/medical-records/patient/${pid}`, { token: patient.token });
  let rxPdfChecked = false;
  for (const record of asArray(records.json?.data)) {
    const rxs = await call('GET', `/api/prescriptions/record/${record.id}`, { token: patient.token });
    const rx = first(rxs.json?.data);
    if (rx) {
      const pdf = await call('GET', `/api/prescriptions/${rx.id}/pdf`, { token: patient.token, binary: true });
      pdf.bytes.subarray(0, 4).toString() === '%PDF'
        ? ok('prescription PDF', `${pdf.bytes.length} bytes`)
        : bad('prescription PDF', `HTTP ${pdf.status}`);
      rxPdfChecked = true;
      break;
    }
  }
  if (!rxPdfChecked) bad('prescription PDF', 'no accessible prescription to test');

  console.log(`\n${failed === 0 ? '\u001b[32mAll checks passed\u001b[0m' : `\u001b[31m${failed} check(s) failed\u001b[0m`} (${passed} passed, ${failed} failed)\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nSmoke test crashed:', err);
  process.exit(1);
});
