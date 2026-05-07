import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../common/prisma/prisma.service';
import { UsersService } from './users.service';
import { createPrismaMock, PrismaMock } from '../../test/mocks/prisma.mock';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe('sync', () => {
    const clerkId = 'clerk_user_abc';

    it('creates the user when it does not exist and reports created=true', async () => {
      const newUser = {
        id: 'uuid-new',
        clerkId,
        createdAt: new Date('2026-05-07T10:00:00Z'),
      };
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(newUser);

      const result = await service.sync(clerkId);

      expect(result).toEqual({ user: newUser, created: true });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { clerkId },
        select: { id: true, clerkId: true, createdAt: true },
      });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { clerkId },
        select: { id: true, clerkId: true, createdAt: true },
      });
    });

    it('returns the existing user without creating when it already exists (idempotent)', async () => {
      const existing = {
        id: 'uuid-existing',
        clerkId,
        createdAt: new Date('2026-04-01T08:00:00Z'),
      };
      prisma.user.findUnique.mockResolvedValue(existing);

      const result = await service.sync(clerkId);

      expect(result).toEqual({ user: existing, created: false });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('resolveUserId', () => {
    const clerkId = 'clerk_user_xyz';

    it('returns the internal id when the user exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'internal-uuid' });

      const id = await service.resolveUserId(clerkId);

      expect(id).toBe('internal-uuid');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { clerkId },
        select: { id: true },
      });
    });

    it('throws NotFoundException when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.resolveUserId(clerkId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
