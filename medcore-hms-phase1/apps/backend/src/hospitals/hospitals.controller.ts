import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HospitalsService } from './hospitals.service';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Hospitals')
@Controller('hospitals')
@ApiBearerAuth()
export class HospitalsController {
  constructor(private hospitalsService: HospitalsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all hospitals (Super Admin only)' })
  async findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.hospitalsService.findAll(parseInt(page), parseInt(limit));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get hospital by ID' })
  async findById(@Param('id') id: string) {
    return this.hospitalsService.findById(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create new hospital' })
  async create(@Body() data: any) {
    return this.hospitalsService.create(data);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Update hospital' })
  async update(@Param('id') id: string, @Body() data: any) {
    return this.hospitalsService.update(id, data);
  }
}
