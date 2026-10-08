import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Departments')
@Controller('departments')
@ApiBearerAuth()
export class DepartmentsController {
  constructor(private departmentsService: DepartmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all departments' })
  async findAll(@TenantId() hospitalId: string) {
    return this.departmentsService.findAll(hospitalId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get department by ID' })
  async findById(@Param('id') id: string) {
    return this.departmentsService.findById(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Create department' })
  async create(@Body() data: any, @TenantId() hospitalId: string) {
    return this.departmentsService.create(hospitalId, data);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Update department' })
  async update(@Param('id') id: string, @Body() data: any) {
    return this.departmentsService.update(id, data);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Deactivate department' })
  async remove(@Param('id') id: string) {
    return this.departmentsService.remove(id);
  }
}
