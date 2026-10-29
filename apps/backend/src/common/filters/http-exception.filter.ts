import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { redact } from '../sanitize';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorResponse = {
      success: false,
      error: {
        code: HttpStatus[status] || 'UNKNOWN_ERROR',
        message: typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || 'An error occurred',
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    const sanitizedRequest = redact(request.body);

    console.error(`[${request.method}] ${request.url} - ${status}`, {
      error: errorResponse.error,
      body: sanitizedRequest,
    });

    response.status(status).json(errorResponse);
  }
}
