import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import type { UserDto } from './dto/user.dto';

export interface SyncUserResult {
  user: UserDto;
  created: boolean;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async sync(clerkId: string): Promise<SyncUserResult> {
    const existing = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, clerkId: true, createdAt: true },
    });

    if (existing) {
      return { user: existing, created: false };
    }

    const created = await this.prisma.user.create({
      data: { clerkId },
      select: { id: true, clerkId: true, createdAt: true },
    });

    return { user: created, created: true };
  }

  async resolveUserId(clerkId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.id;
  }
}
