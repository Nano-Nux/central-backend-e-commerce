import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status = this.getStatus(exception);
    const message = this.getMessage(exception, status);

    response.status(status).json({
      success: false,
      error: {
        message,
        code: this.getCode(exception, status),
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }

  private getStatus(exception: unknown) {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    if (this.isPrismaKnownError(exception)) {
      return this.getPrismaStatus(exception.code);
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getMessage(exception: unknown, status: number) {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response
      ) {
        const message = response.message;

        return Array.isArray(message) ? message.join(', ') : String(message);
      }

      return exception.message;
    }

    if (this.isPrismaKnownError(exception)) {
      return this.getPrismaMessage(exception.code);
    }

    return status === HttpStatus.INTERNAL_SERVER_ERROR
      ? 'Internal server error'
      : 'Request failed';
  }

  private getCode(exception: unknown, status: number) {
    if (this.isPrismaKnownError(exception)) {
      return exception.code;
    }

    return `HTTP_${status}`;
  }

  private getPrismaStatus(code: string) {
    if (code === 'P2002') {
      return HttpStatus.CONFLICT;
    }

    if (code === 'P2025') {
      return HttpStatus.NOT_FOUND;
    }

    return HttpStatus.BAD_REQUEST;
  }

  private getPrismaMessage(code: string) {
    if (code === 'P2002') {
      return 'Unique constraint failed';
    }

    if (code === 'P2025') {
      return 'Record not found';
    }

    return 'Database request failed';
  }

  private isPrismaKnownError(
    exception: unknown,
  ): exception is { code: string; clientVersion: string } {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      'clientVersion' in exception &&
      typeof exception.code === 'string'
    );
  }
}
