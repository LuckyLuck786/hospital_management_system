import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { WardsService } from './wards.service';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Wards')
@Controller('wards')
@ApiBearerAuth()
export class WardsController {
  constructor(private wards: WardsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.NURSE, UserRole.RECEPTIONIST, UserRole.DOCTOR)
  @ApiOperation({ summary: 'Wards and bed occupancy grouped by department' })
  async overview(@TenantId() hospitalId: string) {
    return this.wards.overview(hospitalId);
  }

  @Post('rooms')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Add a room / ward with a bed capacity' })
  async createRoom(@TenantId() hospitalId: string, @Body() data: any) {
    return this.wards.createRoom(hospitalId, data);
  }

  @Patch('rooms/:id/occupancy')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.NURSE)
  @ApiOperation({ summary: 'Set how many beds in a room are occupied' })
  async setOccupancy(
    @Param('id') id: string,
    @TenantId() hospitalId: string,
    @CurrentUser() user: any,
    @Body('occupiedBeds') occupiedBeds: number,
  ) {
    return this.wards.setOccupancy(id, hospitalId, user, occupiedBeds);
  }
}
