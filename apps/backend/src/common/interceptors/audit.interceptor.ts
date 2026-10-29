import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../prisma.service';
import { redact } from '../sanitize';

const METHOD_ACTION: Record<string, string> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

/** Records every successful write (POST/PUT/PATCH/DELETE) by an authenticated user in AuditLog. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    const action = METHOD_ACTION[req.method];
    if (!action || !req.user) return next.handle();

    return next.handle().pipe(
      tap((result) => {
        const segments = String(req.route?.path ?? req.path ?? '')
          .replace(/^\/?(api\/)?/, '')
          .split('/')
          .filter((s) => s && !s.startsWith(':'));
        const entityId =
          req.params?.id ?? (result && typeof result === 'object' && 'id' in (result as object) ? String((result as any).id) : null);
        this.prisma.auditLog
          .create({
            data: {
              hospitalId: req.user.hospitalId ?? null,
              userId: req.user.id,
              action: `${action} ${segments.join('/')}`.slice(0, 120),
              entityType: segments[0] ?? 'unknown',
              entityId: entityId ?? null,
              newValues: redact(req.body ?? {}) as any,
              ipAddress: req.ip ?? null,
              userAgent: String(req.headers?.['user-agent'] ?? '').slice(0, 255) || null,
            },
          })
          .catch((err) => this.logger.warn(`audit write failed: ${err.message}`));
      }),
    );
  }
}
