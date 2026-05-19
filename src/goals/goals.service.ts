import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateGoalDto } from './dto/create-goal.dto';

export interface GoalDto {
  id: string;
  name: string;
  targetAmount: number;
  deadline: Date;
  createdAt: Date;
}

interface GoalRecord {
  id: string;
  name: string;
  targetAmount: Prisma.Decimal;
  deadline: Date;
  createdAt: Date;
}

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async create(clerkId: string, dto: CreateGoalDto): Promise<GoalDto> {
    const userId = await this.usersService.resolveUserId(clerkId);

    const goal = await this.prisma.goal.create({
      data: {
        userId,
        name: dto.name,
        targetAmount: dto.targetAmount,
        deadline: dto.deadline,
      },
      select: {
        id: true,
        name: true,
        targetAmount: true,
        deadline: true,
        createdAt: true,
      },
    });

    return GoalsService.toDto(goal);
  }

  async list(clerkId: string): Promise<GoalDto[]> {
    const userId = await this.usersService.resolveUserId(clerkId);

    const goals = await this.prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        targetAmount: true,
        deadline: true,
        createdAt: true,
      },
    });

    return goals.map((goal) => GoalsService.toDto(goal));
  }

  private static toDto(goal: GoalRecord): GoalDto {
    return {
      id: goal.id,
      name: goal.name,
      targetAmount: Number(goal.targetAmount),
      deadline: goal.deadline,
      createdAt: goal.createdAt,
    };
  }
}
