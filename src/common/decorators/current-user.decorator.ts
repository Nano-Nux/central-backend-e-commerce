import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: unknown }>();
    const user = request.user as Record<string, unknown> | undefined;

    return data && user ? user[data] : user;
  },
);
