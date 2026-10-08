import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Patients')
@Controller('patients')
@ApiBearerAuth()
export class PatientsController {
  constructor(private patientsService: PatientsService) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.DOCTOR,
    UserRole.NURSE,
  )
  @ApiOperation({ summary: 'List patients with search' })
  async findAll(
    @TenantId() hospitalId: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.patientsService.findAll(hospitalId, search, parseInt(page), parseInt(limit));
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.DOCTOR,
    UserRole.NURSE,
    UserRole.PATIENT,
  )
  @ApiOperation({ summary: 'Get patient by ID' })
  async findById(@Param('id') id: string) {
    return this.patientsService.findById(id);
  }
}
