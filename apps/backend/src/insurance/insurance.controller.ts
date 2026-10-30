import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { InsuranceService } from './insurance.service';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Insurance claims')
@Controller('insurance-claims')
@ApiBearerAuth()
export class InsuranceController {
  constructor(private insurance: InsuranceService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.ACCOUNTANT, UserRole.RECEPTIONIST, UserRole.PATIENT)
  @ApiOperation({ summary: 'Insurance / TPA claims (patients see their own)' })
  async list(@TenantId() hospitalId: string, @CurrentUser() user: any, @Query('status') status?: string) {
    return this.insurance.list(hospitalId, user, status);
  }

  @Post()
  @Roles(UserRole.HOSPITAL_ADMIN, UserRole.ACCOUNTANT, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'File a claim against an unpaid invoice' })
  async create(@TenantId() hospitalId: string, @CurrentUser() user: any, @Body() data: any) {
    return this.insurance.create(hospitalId, user, data);
  }

  @Patch(':id/status')
  @Roles(UserRole.HOSPITAL_ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Move a claim through review: UNDER_REVIEW → APPROVED | PARTIALLY_APPROVED | REJECTED' })
  async updateStatus(@Param('id') id: string, @CurrentUser() user: any, @Body() data: any) {
    return this.insurance.updateStatus(id, user, data);
  }

  @Post(':id/settle')
  @Roles(UserRole.HOSPITAL_ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Record the insurer payment on the invoice and close the claim' })
  async settle(@Param('id') id: string, @CurrentUser() user: any, @Body() data: any) {
    return this.insurance.settle(id, user, data);
  }
}
