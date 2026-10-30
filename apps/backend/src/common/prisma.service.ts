import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { decryptDeep, encryptData } from './field-crypto';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    // Encrypt sensitive clinical columns on write, decrypt on read (see field-crypto.ts).
    this.$use(async (params, next) => {
      if (params.model && ['create', 'update', 'upsert', 'createMany', 'updateMany'].includes(params.action)) {
        const a = params.args ?? {};
        if (Array.isArray(a.data)) a.data.forEach((d: any) => encryptData(params.model!, d));
        else encryptData(params.model, a.data);
        encryptData(params.model, a.create);
        encryptData(params.model, a.update);
      }
      return decryptDeep(await next(params));
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
