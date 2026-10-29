import { Controller, Get, Post, Patch, Body, Param, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_UPLOAD_BYTES } from '../storage/storage.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MedicalRecordsService } from './medical-records.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Medical Records')
@Controller('medical-records')
@ApiBearerAuth()
export class MedicalRecordsController {
  constructor(private medicalRecordsService: MedicalRecordsService) {}

  @Get('patient/:patientId')
  @Roles(UserRole.DOCTOR, UserRole.NURSE, UserRole.PATIENT)
  @ApiOperation({ summary: 'Get medical records by patient ID' })
  async findByPatient(@Param('patientId') patientId: string, @CurrentUser() user: any) {
    return this.medicalRecordsService.findByPatient(patientId, user);
  }

  @Post(':id/attachments')
  @Roles(UserRole.DOCTOR, UserRole.NURSE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @ApiOperation({ summary: 'Attach a file (PDF/image, max 20 MB) to a medical record' })
  async addAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('description') description: string,
    @CurrentUser() user: any,
  ) {
    return this.medicalRecordsService.addAttachment(id, file, user, description);
  }

  @Get(':id/attachments/:attachmentId/url')
  @ApiOperation({ summary: 'Get a short-lived signed download URL for an attachment' })
  async attachmentUrl(@Param('id') id: string, @Param('attachmentId') attachmentId: string, @CurrentUser() user: any) {
    return this.medicalRecordsService.attachmentUrl(id, attachmentId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get medical record by ID' })
  async findById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.medicalRecordsService.findById(id, user);
  }

  @Post()
  @Roles(UserRole.DOCTOR)
  @ApiOperation({ summary: 'Create medical record for an appointment' })
  async create(
    @Body() data: any,
    @TenantId() hospitalId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.medicalRecordsService.create(hospitalId, userId, data);
  }

  @Patch(':id')
  @Roles(UserRole.DOCTOR)
  @ApiOperation({ summary: 'Update medical record' })
  async update(@Param('id') id: string, @Body() data: any, @CurrentUser() user: any) {
    return this.medicalRecordsService.update(id, data, user);
  }
}
