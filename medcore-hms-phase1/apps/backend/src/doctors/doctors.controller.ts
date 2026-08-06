import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DoctorsService } from './doctors.service';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Doctors')
@Controller('doctors')
@ApiBearerAuth()
export class DoctorsController {
  constructor(private doctorsService: DoctorsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all doctors' })
  async findAll(
    @TenantId() hospitalId: string,
    @Query('specialization') specialization?: string,
    @Query('departmentId') departmentId?: string,
    @Query('isAvailable') isAvailable?: string,
  ) {
    return this.doctorsService.findAll(
      hospitalId,
      specialization,
      departmentId,
      isAvailable !== undefined ? isAvailable === 'true' : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get doctor by ID' })
  async findById(@Param('id') id: string) {
    return this.doctorsService.findById(id);
  }

  @Get(':id/availability')
  @ApiOperation({ summary: 'Get doctor availability' })
  async getAvailability(@Param('id') id: string, @Query('date') date?: string) {
    return this.doctorsService.getAvailability(id, date);
  }

  @Patch(':id/schedule')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.DOCTOR)
  @ApiOperation({ summary: 'Update doctor schedule' })
  async updateSchedule(@Param('id') id: string, @Body() schedule: any) {
    return this.doctorsService.updateSchedule(id, schedule);
  }
}
