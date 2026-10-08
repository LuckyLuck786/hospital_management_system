import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MedicinesService } from './medicines.service';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Medicines')
@Controller('medicines')
@ApiBearerAuth()
export class MedicinesController {
  constructor(private medicinesService: MedicinesService) {}

  @Get()
  @ApiOperation({ summary: 'List medicines with search and stock' })
  async findAll(
    @TenantId() hospitalId: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.medicinesService.findAll(hospitalId, search, parseInt(page), parseInt(limit));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get medicine by ID' })
  async findById(@Param('id') id: string) {
    return this.medicinesService.findById(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'Create a medicine' })
  async create(@Body() data: any, @TenantId() hospitalId: string) {
    return this.medicinesService.create(hospitalId, data);
  }

  @Post(':id/batches')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'Add a stock batch to a medicine' })
  async addBatch(@Param('id') id: string, @Body() data: any) {
    return this.medicinesService.addBatch(id, data);
  }
}
