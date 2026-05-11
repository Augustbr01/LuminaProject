import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyToken } from '@clerk/clerk-sdk-node';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { RequestWithUser } from '../types/request-with-user.type';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & Partial<RequestWithUser>>();

    const token = this.extractToken(request);

    if (!token) throw new UnauthorizedException();

    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
        issuer: null,
      });
      request.user = { clerkId: payload.sub };
    } catch {
      throw new UnauthorizedException();
    }

    return true;
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
