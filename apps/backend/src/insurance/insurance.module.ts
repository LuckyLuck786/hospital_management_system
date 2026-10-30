import { Module } from '@nestjs/common';
import { InsuranceService } from './insurance.service';
import { InsuranceController } from './insurance.controller';
import { InvoicesModule } from '../invoices/invoices.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [InvoicesModule, NotificationsModule],
  providers: [InsuranceService],
  controllers: [InsuranceController],
})
export class InsuranceModule {}
