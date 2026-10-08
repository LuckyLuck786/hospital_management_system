import { Injectable, Logger, OnModuleDestroy, NotFoundException, ForbiddenException } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';
import { PrismaService } from '../common/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browserPromise: Promise<Browser> | null = null;

  constructor(private prisma: PrismaService) {}

  private getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = puppeteer
        .launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        })
        .catch((err) => {
          this.logger.error(`Puppeteer launch failed: ${err.message}`);
          this.browserPromise = null;
          throw err;
        });
    }
    return this.browserPromise;
  }

  async onModuleDestroy() {
    if (this.browserPromise) {
      const browser = await this.browserPromise.catch(() => null);
      if (browser) await browser.close();
    }
  }

  private async render(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '36px', bottom: '36px', left: '28px', right: '28px' },
      });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  // ---------- shared template pieces ----------

  private letterhead(hospital: { name: string; email?: string | null; phone?: string | null }) {
    return `
    <div class="lh">
      <div class="lh-logo">
        <svg viewBox="0 0 32 32" width="40" height="40"><rect width="32" height="32" rx="8" fill="#4f46e5"/><path d="M12 7h8v5h5v8h-5v5h-8v-5H7v-8h5z" fill="#fff"/></svg>
        <div>
          <div class="lh-brand">MedCore <span>HMS</span></div>
          <div class="lh-sub">Hospital Management Platform</div>
        </div>
      </div>
      <div class="lh-meta">
        <div class="lh-name">${hospital.name || 'MedCore Hospital'}</div>
        <div>${hospital.email || ''}${hospital.phone ? ` &middot; ${hospital.phone}` : ''}</div>
      </div>
    </div>`;
  }

  private signature(name: string, title: string) {
    return `
    <div class="sig">
      <svg width="220" height="60" viewBox="0 0 220 60">
        <text x="6" y="44" font-family="'Segoe Script','Brush Script MT',cursive" font-size="38" fill="#1f2937">${name}</text>
      </svg>
      <div class="sig-name">${name}</div>
      <div class="sig-title">${title}</div>
      <div class="sig-note">Digitally issued via MedCore HMS</div>
    </div>`;
  }

  private baseCss = `
    <style>
      * { box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; font-size: 13px; margin: 0; }
      .lh { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px; }
      .lh-logo { display: flex; align-items: center; gap: 10px; }
      .lh-brand { font-size: 20px; font-weight: 800; color: #111827; }
      .lh-brand span { color: #4f46e5; }
      .lh-sub { font-size: 11px; color: #6b7280; }
      .lh-meta { text-align: right; }
      .lh-name { font-size: 15px; font-weight: 700; }
      .lh-meta div:last-child { font-size: 11px; color: #6b7280; margin-top: 2px; }
      h1 { font-size: 18px; margin: 0 0 14px; color: #4f46e5; }
      .info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; margin-bottom: 18px; }
      .info div span { color: #6b7280; font-size: 11px; display: block; }
      .info div strong { font-size: 13px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th { text-align: left; background: #eef2ff; color: #3730a3; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; padding: 8px 10px; }
      td { padding: 9px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
      tr:last-child td { border-bottom: none; }
      .abnormal { color: #dc2626; font-weight: 700; }
      .flag { background: #fee2e2; color: #dc2626; border-radius: 4px; padding: 1px 6px; font-size: 10px; font-weight: 700; }
      .note { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 14px; color: #92400e; font-size: 12px; white-space: pre-line; }
      .sig { margin-top: 36px; text-align: right; }
      .sig-name { font-weight: 700; margin-top: 2px; }
      .sig-title { color: #6b7280; font-size: 12px; }
      .sig-note { color: #9ca3af; font-size: 10px; margin-top: 2px; }
      .footer { margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 10px; color: #9ca3af; text-align: center; }
    </style>`;

  // ---------- prescription ----------

  async prescriptionPdf(id: string, user: any): Promise<Buffer> {
    const rx = await this.prisma.prescription.findUnique({
      where: { id },
      include: {
        items: { include: { medicine: true } },
        doctor: { select: { specialization: true, user: { select: { firstName: true, lastName: true, email: true } } } },
        medicalRecord: {
          include: {
            patient: {
              include: { user: { select: { firstName: true, lastName: true, phone: true, dateOfBirth: true, gender: true } } },
            },
          },
        },
        hospital: { select: { name: true, email: true, phone: true } },
      },
    });
    if (!rx) throw new NotFoundException('Prescription not found');
    if (user.role !== UserRole.SUPER_ADMIN && rx.hospitalId !== user.hospitalId) {
      throw new ForbiddenException('Access denied');
    }
    if (user.role === UserRole.PATIENT) {
      const patient = await this.prisma.patient.findUnique({ where: { userId: user.id } });
      if (!patient || rx.medicalRecord.patientId !== patient.id) throw new ForbiddenException('Access denied');
    }
    if (user.role === UserRole.DOCTOR) {
      const doctor = await this.prisma.doctor.findUnique({ where: { userId: user.id } });
      if (!doctor || rx.doctorId !== doctor.id) throw new ForbiddenException('Access denied');
    }

    const p = rx.medicalRecord.patient.user;
    const dr = rx.doctor.user;
    const rows = rx.items
      .map(
        (item, i) => `<tr>
          <td>${i + 1}</td>
          <td><strong>${item.medicine.name}</strong><br/><span style="color:#6b7280">${item.medicine.form || ''} · ${item.medicine.genericName || ''}</span></td>
          <td>${item.dosage}</td>
          <td>${item.frequency}</td>
          <td>${item.duration} ${item.durationUnit.toLowerCase()}</td>
          <td>${item.instructions || '—'}</td>
        </tr>`,
      )
      .join('');

    const html = `<html><head>${this.baseCss}</head><body>
      ${this.letterhead(rx.hospital)}
      <h1>Prescription</h1>
      <div class="info">
        <div><span>Patient</span><strong>${p.firstName} ${p.lastName}</strong></div>
        <div><span>Prescription No.</span><strong>${rx.prescriptionNumber}</strong></div>
        <div><span>Phone</span><strong>${p.phone || '—'}</strong></div>
        <div><span>Date</span><strong>${rx.createdAt.toISOString().slice(0, 10)}</strong></div>
        <div><span>Doctor</span><strong>${dr.firstName} ${dr.lastName}</strong></div>
        <div><span>Gender / DOB</span><strong>${p.gender || '—'}${p.dateOfBirth ? ` / ${new Date(p.dateOfBirth).toISOString().slice(0, 10)}` : ''}</strong></div>
      </div>
      <table>
        <thead><tr><th style="width:28px">#</th><th>Medicine</th><th style="width:70px">Dosage</th><th style="width:80px">Frequency</th><th style="width:90px">Duration</th><th>Instructions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${rx.instructions ? `<div class="note">${rx.instructions}</div>` : ''}
      ${this.signature(`${dr.firstName} ${dr.lastName}`, `${rx.doctor.specialization || 'Consultant'}`)}
      <div class="footer">This is a computer-generated prescription and is valid without a physical signature.</div>
    </body></html>`;

    return this.render(html);
  }

  // ---------- lab report ----------

  async labReportPdf(id: string, user: any): Promise<Buffer> {
    const order = await this.prisma.labOrder.findUnique({
      where: { id },
      include: {
        tests: { include: { catalog: true } },
        results: true,
        orderedBy: { select: { firstName: true, lastName: true } },
        reviewedBy: { select: { firstName: true, lastName: true } },
        hospital: { select: { name: true, email: true, phone: true } },
        medicalRecord: {
          include: {
            patient: {
              include: { user: { select: { firstName: true, lastName: true, phone: true, gender: true, dateOfBirth: true } } },
            },
            doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Lab order not found');
    if (user.role !== UserRole.SUPER_ADMIN && order.hospitalId !== user.hospitalId) {
      throw new ForbiddenException('Access denied');
    }
    if (user.role === UserRole.PATIENT) {
      const patient = await this.prisma.patient.findUnique({ where: { userId: user.id } });
      if (!patient || order.patientId !== patient.id) throw new ForbiddenException('Access denied');
    }
    if (user.role === UserRole.DOCTOR) {
      const doctor = await this.prisma.doctor.findUnique({ where: { userId: user.id } });
      if (!doctor || order.medicalRecord.doctorId !== doctor.id) throw new ForbiddenException('Access denied');
    }

    const p = order.medicalRecord.patient.user;
    const rows = order.results
      .map(
        (r) => `<tr>
          <td><strong>${r.testName}</strong></td>
          <td class="${r.isAbnormal ? 'abnormal' : ''}">${r.value}${r.unit ? ` <span style="color:#6b7280;font-weight:400">${r.unit}</span>` : ''}</td>
          <td>${r.referenceRange || '—'}</td>
          <td>${r.isAbnormal ? '<span class="flag">ABNORMAL</span>' : '<span style="color:#059669">Normal</span>'}</td>
        </tr>`,
      )
      .join('');
    const dr = order.medicalRecord.doctor.user;
    const approver = order.reviewedBy;

    const html = `<html><head>${this.baseCss}</head><body>
      ${this.letterhead(order.hospital)}
      <h1>Laboratory Report</h1>
      <div class="info">
        <div><span>Patient</span><strong>${p.firstName} ${p.lastName}</strong></div>
        <div><span>Order No.</span><strong>${order.orderNumber}</strong></div>
        <div><span>Phone</span><strong>${p.phone || '—'}</strong></div>
        <div><span>Collected</span><strong>${order.sampleCollectedAt ? order.sampleCollectedAt.toISOString().slice(0, 10) : order.createdAt.toISOString().slice(0, 10)}</strong></div>
        <div><span>Referred By</span><strong>${dr.firstName} ${dr.lastName}</strong></div>
        <div><span>Status</span><strong>${order.status.replace(/_/g, ' ')}</strong></div>
      </div>
      <table>
        <thead><tr><th>Test</th><th style="width:140px">Result</th><th style="width:160px">Reference Range</th><th style="width:90px">Flag</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="font-size:11px;color:#6b7280">Reference ranges are population-based; clinical interpretation by the referring physician is advised.</div>
      ${approver ? this.signature(`${approver.firstName} ${approver.lastName}`, 'Lab Technician · Approved') : ''}
      <div class="footer">This is a computer-generated lab report issued via MedCore HMS.</div>
    </body></html>`;

    return this.render(html);
  }
}
