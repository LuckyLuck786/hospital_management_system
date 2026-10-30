import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Audit')
@Controller('audit-logs')
@ApiBearerAuth()
export class AuditController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Write-operation audit trail (who did what, when, from where)' })
  async list(
    @TenantId() hospitalId: string,
    @CurrentUser() user: any,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
  ) {
    const take = Math.min(parseInt(limit) || 25, 100);
    const p = Math.max(parseInt(page) || 1, 1);
    const where: any = {};
    if (user.role !== UserRole.SUPER_ADMIN) where.hospitalId = hospitalId;
    if (entityType) where.entityType = entityType;
    if (action) where.action = { startsWith: action.toUpperCase() };
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { firstName: true, lastName: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * take,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, meta: { page: p, limit: take, total, totalPages: Math.ceil(total / take) } };
  }
}
