import { Controller, Get, Param, Res, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { PdfService } from './pdf.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('PDF')
@Controller()
@ApiBearerAuth()
export class PdfController {
  constructor(private pdfService: PdfService) {}

  @Get('prescriptions/:id/pdf')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DOCTOR,
    UserRole.NURSE,
    UserRole.RECEPTIONIST,
    UserRole.PHARMACIST,
    UserRole.PATIENT,
  )
  @Header('Content-Type', 'application/pdf')
  @ApiOperation({ summary: 'Download a prescription as PDF (with letterhead + signature)' })
  async prescriptionPdf(@Param('id') id: string, @CurrentUser() user: any, @Res() res: Response) {
    const buffer = await this.pdfService.prescriptionPdf(id, user);
    res.setHeader('Content-Disposition', `attachment; filename="prescription-${id.slice(0, 8)}.pdf"`);
    res.send(buffer);
  }

  @Get('lab/orders/:id/pdf')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DOCTOR,
    UserRole.NURSE,
    UserRole.RECEPTIONIST,
    UserRole.LAB_TECHNICIAN,
    UserRole.PATIENT,
  )
  @Header('Content-Type', 'application/pdf')
  @ApiOperation({ summary: 'Download a lab report as PDF' })
  async labReportPdf(@Param('id') id: string, @CurrentUser() user: any, @Res() res: Response) {
    const buffer = await this.pdfService.labReportPdf(id, user);
    res.setHeader('Content-Disposition', `attachment; filename="lab-report-${id.slice(0, 8)}.pdf"`);
    res.send(buffer);
  }
}
