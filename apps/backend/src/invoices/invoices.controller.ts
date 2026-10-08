import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Invoices')
@Controller('invoices')
@ApiBearerAuth()
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.ACCOUNTANT,
    UserRole.PATIENT,
  )
  @ApiOperation({ summary: 'List invoices (patients see only their own)' })
  async findAll(
    @TenantId() hospitalId: string,
    @CurrentUser() user: any,
    @Query() query: any,
  ) {
    return this.invoicesService.findAll(
      hospitalId,
      user,
      query,
      parseInt(query.page) || 1,
      parseInt(query.limit) || 20,
    );
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.ACCOUNTANT,
    UserRole.PATIENT,
  )
  @ApiOperation({ summary: 'Get invoice by ID' })
  async findById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.invoicesService.findById(id, user);
  }

  @Patch(':id/finalize')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Finalise a draft invoice (recomputes totals)' })
  async finalize(@Param('id') id: string, @CurrentUser() user: any, @Body('taxRate') taxRate?: number) {
    return this.invoicesService.finalize(id, user, taxRate);
  }

  @Post(':id/pay')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.ACCOUNTANT,
    UserRole.PATIENT,
  )
  @ApiOperation({ summary: 'Record a payment against an invoice' })
  async pay(
    @Param('id') id: string,
    @Body() data: any,
    @CurrentUser() user: any,
  ) {
    return this.invoicesService.pay(id, user, data);
  }
}
