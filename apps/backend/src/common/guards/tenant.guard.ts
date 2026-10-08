import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return true;
    if (user.role === UserRole.SUPER_ADMIN) return true;

    const hospitalId = request.params.hospitalId || request.query.hospitalId || request.body.hospitalId;
    if (!hospitalId) {
      request.hospitalId = user.hospitalId;
      return true;
    }

    if (user.hospitalId && user.hospitalId !== hospitalId) {
      throw new ForbiddenException('You do not have access to this hospital');
    }

    request.hospitalId = hospitalId;
    return true;
  }
}
