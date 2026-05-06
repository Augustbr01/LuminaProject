import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestWithUser } from '../types/request-with-user.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): { clerkId: string } => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
