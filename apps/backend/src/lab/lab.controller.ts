import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LabService } from './lab.service';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole, LabOrderStatus } from '@prisma/client';

@ApiTags('Lab')
@Controller('lab')
@ApiBearerAuth()
export class LabController {
  constructor(private labService: LabService) {}

  @Get('catalog')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.DOCTOR, UserRole.LAB_TECHNICIAN)
  @ApiOperation({ summary: 'Search the lab test catalog' })
  async getCatalog(@TenantId() hospitalId: string, @Query('search') search?: string) {
    return this.labService.getCatalog(hospitalId, search);
  }

  @Post('orders')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.DOCTOR)
  @ApiOperation({ summary: 'Create a lab order from a medical record' })
  async createOrder(
    @TenantId() hospitalId: string,
    @CurrentUser('id') userId: string,
    @Body() data: any,
  ) {
    return this.labService.createOrder(hospitalId, userId, data);
  }

  @Get('orders')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DOCTOR,
    UserRole.NURSE,
    UserRole.RECEPTIONIST,
    UserRole.LAB_TECHNICIAN,
    UserRole.PATIENT,
  )
  @ApiOperation({ summary: 'List lab orders (scoped by role)' })
  async findAll(
    @TenantId() hospitalId: string,
    @CurrentUser() user: any,
    @Query('status') status?: string,
  ) {
    return this.labService.findAll(hospitalId, user, status);
  }

  @Get('orders/:id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DOCTOR,
    UserRole.NURSE,
    UserRole.RECEPTIONIST,
    UserRole.LAB_TECHNICIAN,
    UserRole.PATIENT,
  )
  @ApiOperation({ summary: 'Get a lab order by ID' })
  async findById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.labService.findById(id, user);
  }

  @Patch('orders/:id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.LAB_TECHNICIAN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Advance the lab order workflow (sample → processing → approved)' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: LabOrderStatus,
    @CurrentUser() user: any,
  ) {
    return this.labService.updateStatus(id, user, status);
  }

  @Post('orders/:id/results')
  @Roles(UserRole.SUPER_ADMIN, UserRole.LAB_TECHNICIAN)
  @ApiOperation({ summary: 'Enter structured results for an order (auto-flags abnormal values)' })
  async enterResults(
    @Param('id') id: string,
    @Body('results') results: Array<{ testId: string; value: string; unit?: string }>,
    @CurrentUser() user: any,
  ) {
    return this.labService.enterResults(id, user, results);
  }
}
