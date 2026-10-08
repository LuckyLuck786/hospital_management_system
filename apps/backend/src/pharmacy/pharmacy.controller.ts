import { Controller, Get, Post, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PharmacyService } from './pharmacy.service';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Pharmacy')
@Controller('pharmacy')
@ApiBearerAuth()
export class PharmacyController {
  constructor(private pharmacyService: PharmacyService) {}

  @Get('prescriptions/pending')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'Prescriptions waiting for fulfilment (with live stock)' })
  async pendingPrescriptions(@TenantId() hospitalId: string) {
    return this.pharmacyService.pendingPrescriptions(hospitalId);
  }

  @Post('dispense/:prescriptionId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'Dispense a prescription (FIFO stock, adds pharmacy charges)' })
  async dispense(
    @TenantId() hospitalId: string,
    @CurrentUser('id') userId: string,
    @Param('prescriptionId') prescriptionId: string,
  ) {
    return this.pharmacyService.dispense(hospitalId, userId, prescriptionId);
  }

  @Get('low-stock')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'Medicines at or below their reorder level' })
  async lowStock(@TenantId() hospitalId: string) {
    return this.pharmacyService.lowStock(hospitalId);
  }
}
