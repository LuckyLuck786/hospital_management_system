import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BedStatus, UserRole } from '@prisma/client';
import { WardsService } from './wards.service';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const WARD_STAFF = [UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.NURSE, UserRole.RECEPTIONIST];

@ApiTags('Wards')
@Controller('wards')
@ApiBearerAuth()
export class WardsController {
  constructor(private wards: WardsService) {}

  @Get()
  @Roles(...WARD_STAFF, UserRole.DOCTOR)
  @ApiOperation({ summary: 'Wards, rooms and individual beds with the patient in each' })
  async overview(@TenantId() hospitalId: string) {
    return this.wards.overview(hospitalId);
  }

  @Get('admissions')
  @Roles(...WARD_STAFF, UserRole.DOCTOR)
  @ApiOperation({ summary: 'Patients currently admitted to a bed' })
  async admissions(@TenantId() hospitalId: string) {
    return this.wards.admissions(hospitalId);
  }

  @Post('rooms')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Add a room; one bed is created per unit of capacity' })
  async createRoom(@TenantId() hospitalId: string, @Body() data: any) {
    return this.wards.createRoom(hospitalId, data);
  }

  @Post('beds/:id/admit')
  @Roles(...WARD_STAFF)
  @ApiOperation({ summary: 'Admit a patient to an available bed' })
  async admit(@Param('id') id: string, @TenantId() hospitalId: string, @CurrentUser() user: any, @Body() data: any) {
    return this.wards.admit(id, hospitalId, user, data);
  }

  @Post('beds/:id/transfer')
  @Roles(...WARD_STAFF)
  @ApiOperation({ summary: 'Move the admitted patient to another free bed in one step' })
  async transfer(@Param('id') id: string, @TenantId() hospitalId: string, @CurrentUser() user: any, @Body() data: any) {
    return this.wards.transfer(id, hospitalId, user, data);
  }

  @Post('beds/:id/discharge')
  @Roles(...WARD_STAFF)
  @ApiOperation({ summary: 'Discharge the patient; the bed moves to CLEANING' })
  async discharge(@Param('id') id: string, @TenantId() hospitalId: string, @CurrentUser() user: any) {
    return this.wards.discharge(id, hospitalId, user);
  }

  @Patch('beds/:id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.NURSE)
  @ApiOperation({ summary: 'Mark an empty bed AVAILABLE, CLEANING or MAINTENANCE' })
  async setStatus(@Param('id') id: string, @TenantId() hospitalId: string, @CurrentUser() user: any, @Body('status') status: BedStatus) {
    return this.wards.setStatus(id, hospitalId, user, status);
  }
}
