import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrescriptionsService } from './prescriptions.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Prescriptions')
@Controller('prescriptions')
@ApiBearerAuth()
export class PrescriptionsController {
  constructor(private prescriptionsService: PrescriptionsService) {}

  @Post()
  @Roles(UserRole.DOCTOR)
  @ApiOperation({ summary: 'Create prescription' })
  async create(@Body() data: any, @TenantId() hospitalId: string, @CurrentUser('id') doctorId: string) {
    return this.prescriptionsService.create(hospitalId, doctorId, data);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.DOCTOR)
  @ApiOperation({ summary: 'List prescriptions (doctors see their own)' })
  async findAll(@TenantId() hospitalId: string, @CurrentUser() user: any) {
    return this.prescriptionsService.findAll(hospitalId, user);
  }

  // Static route must be declared BEFORE the :id route so it is not shadowed
  @Get('record/:medicalRecordId')
  @ApiOperation({ summary: 'Get prescriptions by medical record' })
  async findByMedicalRecord(
    @Param('medicalRecordId') medicalRecordId: string,
    @CurrentUser() user: any,
  ) {
    return this.prescriptionsService.findByMedicalRecord(medicalRecordId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get prescription by ID' })
  async findById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.prescriptionsService.findById(id, user);
  }
}
