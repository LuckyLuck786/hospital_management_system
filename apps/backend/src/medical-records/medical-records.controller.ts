import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
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
