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

  @Get('pre-auth')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.ACCOUNTANT, UserRole.RECEPTIONIST, UserRole.DOCTOR, UserRole.PATIENT)
  @ApiOperation({ summary: 'Cashless pre-authorisation requests (patients see their own)' })
  async listPreAuths(@TenantId() hospitalId: string, @CurrentUser() user: any, @Query('status') status?: string) {
    return this.insurance.listPreAuths(hospitalId, user, status);
  }

  @Post('pre-auth')
  @Roles(UserRole.HOSPITAL_ADMIN, UserRole.ACCOUNTANT, UserRole.RECEPTIONIST, UserRole.DOCTOR)
  @ApiOperation({ summary: 'Request cashless pre-authorisation for planned treatment' })
  async createPreAuth(@TenantId() hospitalId: string, @CurrentUser() user: any, @Body() data: any) {
    return this.insurance.createPreAuth(hospitalId, user, data);
  }

  @Patch('pre-auth/:id/status')
  @Roles(UserRole.HOSPITAL_ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Record the insurer decision on a pre-authorisation' })
  async updatePreAuth(@Param('id') id: string, @CurrentUser() user: any, @Body() data: any) {
    return this.insurance.updatePreAuth(id, user, data);
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
