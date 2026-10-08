import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole, AppointmentStatus } from '@prisma/client';

@ApiTags('Appointments')
@Controller('appointments')
@ApiBearerAuth()
export class AppointmentsController {
  constructor(private appointmentsService: AppointmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all appointments (scoped by role)' })
  async findAll(
    @TenantId() hospitalId: string,
    @Query() query: any,
    @CurrentUser() user: any,
  ) {
    return this.appointmentsService.findAll(
      hospitalId,
      query,
      user,
      parseInt(query.page) || 1,
      parseInt(query.limit) || 20,
    );
  }

  @Get('today')
  @ApiOperation({ summary: "Get today's appointments (scoped by role)" })
  async getToday(
    @TenantId() hospitalId: string,
    @Query('doctorId') doctorId?: string,
    @CurrentUser() user?: any,
  ) {
    return this.appointmentsService.getTodayAppointments(hospitalId, doctorId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get appointment by ID' })
  async findById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.appointmentsService.findById(id, user);
  }

  @Post()
  @Roles(UserRole.RECEPTIONIST, UserRole.PATIENT, UserRole.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Create appointment' })
  async create(
    @Body() data: any,
    @TenantId() hospitalId: string,
    @CurrentUser() user: any,
  ) {
    return this.appointmentsService.create(hospitalId, data, user);
  }

  @Patch(':id/status')
  @Roles(UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Update appointment status' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: AppointmentStatus,
    @Body('notes') notes?: string,
    @CurrentUser() user?: any,
  ) {
    return this.appointmentsService.updateStatus(id, status, notes, user);
  }
}
