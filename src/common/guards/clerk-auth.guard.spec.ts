import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const mockVerifyToken = jest.fn();

jest.mock('@clerk/clerk-sdk-node', () => ({
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
}));

function buildContext(options: {
  authorization?: string;
  isPublic?: boolean;
}): ExecutionContext {
  const request = {
    headers: {
      authorization: options.authorization,
    },
    user: undefined as unknown,
  };

  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(options.isPublic ?? false),
  };

  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
    // reflector is injected separately — this context just carries handler/class
  } as unknown as ExecutionContext;
}

describe('ClerkAuthGuard', () => {
  let guard: ClerkAuthGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new ClerkAuthGuard(reflector);
    mockVerifyToken.mockReset();
    process.env.CLERK_SECRET_KEY = 'test_secret_key';
  });

  describe('when route is @Public()', () => {
    it('bypasses the guard and returns true', async () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const ctx = buildContext({ isPublic: true });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });
  });

  describe('when Authorization header is missing', () => {
    it('throws UnauthorizedException', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const ctx = buildContext({ authorization: undefined });

      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });
  });

  describe('when token has wrong scheme (not Bearer)', () => {
    it('throws UnauthorizedException', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const ctx = buildContext({ authorization: 'Basic sometoken' });

      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('when token is invalid or expired', () => {
    it('throws UnauthorizedException', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      mockVerifyToken.mockRejectedValue(new Error('Token verification failed'));
      const ctx = buildContext({ authorization: 'Bearer invalid.token.here' });

      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('when token is valid', () => {
    it('returns true and populates request.user.clerkId', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      mockVerifyToken.mockResolvedValue({ sub: 'user_abc123' });

      const request = {
        headers: { authorization: 'Bearer valid.jwt.token' },
        user: undefined as unknown,
      };
      const ctx = {
        switchToHttp: () => ({ getRequest: () => request }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(request.user).toEqual({ clerkId: 'user_abc123' });
      expect(mockVerifyToken).toHaveBeenCalledWith('valid.jwt.token', {
        secretKey: 'test_secret_key',
        issuer: null,
      });
    });

    it('passes IS_PUBLIC_KEY to reflector correctly', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      mockVerifyToken.mockResolvedValue({ sub: 'user_xyz' });

      const handler = {};
      const cls = {};
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: 'Bearer tok' },
            user: undefined,
          }),
        }),
        getHandler: () => handler,
        getClass: () => cls,
      } as unknown as ExecutionContext;

      await guard.canActivate(ctx);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        handler,
        cls,
      ]);
    });
  });
});
