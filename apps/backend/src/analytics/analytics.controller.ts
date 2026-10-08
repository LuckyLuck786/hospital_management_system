import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

const STAFF = [
  UserRole.SUPER_ADMIN,
  UserRole.HOSPITAL_ADMIN,
  UserRole.DOCTOR,
  UserRole.NURSE,
  UserRole.RECEPTIONIST,
  UserRole.LAB_TECHNICIAN,
  UserRole.PHARMACIST,
  UserRole.ACCOUNTANT,
];

@ApiTags('Analytics')
@Controller('analytics')
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Role-aware dashboard KPIs and panels' })
  async dashboard(@TenantId() hospitalId: string, @CurrentUser() user: any) {
    return this.analyticsService.dashboard(hospitalId, user);
  }

  @Get('revenue')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Daily revenue series (paid amounts) between dates' })
  async revenue(
    @TenantId() hospitalId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.revenue(hospitalId, from, to);
  }

  @Get('appointment-volume')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Appointment volume per day for the last N days' })
  async appointmentVolume(@TenantId() hospitalId: string, @Query('days') days?: string) {
    return this.analyticsService.appointmentVolume(hospitalId, parseInt(days) || 14);
  }

  @Get('patient-growth')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'New patient registrations per day for the last N days' })
  async patientGrowth(@TenantId() hospitalId: string, @Query('days') days?: string) {
    return this.analyticsService.patientGrowth(hospitalId, parseInt(days) || 14);
  }
}
