import { Injectable, PipeTransform } from '@nestjs/common';

export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
}

@Injectable()
export class PaginationPipe implements PipeTransform {
  transform(value: any): PaginationOptions {
    const page = Math.max(1, parseInt(value?.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(value?.limit, 10) || 20));
    return { page, limit, skip: (page - 1) * limit };
  }
}
