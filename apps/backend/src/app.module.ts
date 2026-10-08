import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HospitalsModule } from './hospitals/hospitals.module';
import { DepartmentsModule } from './departments/departments.module';
import { DoctorsModule } from './doctors/doctors.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { MedicalRecordsModule } from './medical-records/medical-records.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { PatientsModule } from './patients/patients.module';
import { MedicinesModule } from './medicines/medicines.module';
import { NotificationsModule } from './notifications/notifications.module';
import { InvoicesModule } from './invoices/invoices.module';
import { LabModule } from './lab/lab.module';
import { PharmacyModule } from './pharmacy/pharmacy.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SearchModule } from './search/search.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ChannelsModule } from './channels/channels.module';
import { JobsModule } from './jobs/jobs.module';
import { PdfModule } from './pdf/pdf.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './common/prisma.module';
import { RedisModule } from './common/redis.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    RedisModule,
    RealtimeModule,
    ChannelsModule,
    JobsModule,
    PdfModule,
    PaymentsModule,
    AuthModule,
    UsersModule,
    HospitalsModule,
    DepartmentsModule,
    DoctorsModule,
    AppointmentsModule,
    MedicalRecordsModule,
    PrescriptionsModule,
    PatientsModule,
    MedicinesModule,
    NotificationsModule,
    InvoicesModule,
    LabModule,
    PharmacyModule,
    AnalyticsModule,
    SearchModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
