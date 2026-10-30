import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
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
  async findById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.findById(id, user);
  }

  @Get(':id/vaccinations')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.PATIENT)
  @ApiOperation({ summary: 'Vaccination history for a patient' })
  async listVaccinations(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.listVaccinations(id, user);
  }

  @Post(':id/vaccinations')
  @Roles(UserRole.DOCTOR, UserRole.NURSE)
  @ApiOperation({ summary: 'Record a vaccination (date, vaccine, batch, next due date)' })
  async addVaccination(@Param('id') id: string, @Body() data: any, @CurrentUser() user: any) {
    return this.patientsService.addVaccination(id, data, user);
  }

  @Patch(':id/family-history')
  @Roles(UserRole.DOCTOR, UserRole.NURSE)
  @ApiOperation({ summary: 'Update family-history flags (diabetes, hypertension, cancer, cardiac)' })
  async updateFamilyHistory(@Param('id') id: string, @Body() data: any, @CurrentUser() user: any) {
    return this.patientsService.updateFamilyHistory(id, data, user);
  }
}
