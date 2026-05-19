import { Injectable } from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';
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

export interface GoalWithProgressDto extends GoalDto {
  valorAcumulado: number;
  percentual: number;
  previsaoConclusao: Date | null;
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

  async list(clerkId: string): Promise<GoalWithProgressDto[]> {
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

    if (goals.length === 0) {
      return [];
    }

    // Monthly investment rate is a user-level figure (whole history of
    // imported extratos) — computed once and reused for every goal.
    const mediaMensal = await this.monthlyInvestmentRate(userId);

    return Promise.all(
      goals.map((goal) => this.enrichGoal(userId, goal, mediaMensal)),
    );
  }

  /**
   * Average monthly investment rate over the user's whole extrato history.
   * Numerator: total of every `investimento` transaction the user has.
   * Denominator: count of distinct months (`mesAno`) that have at least one
   * transaction. Returns 0 when there is no history (no rate to project).
   * OQ-1, item 2.
   */
  private async monthlyInvestmentRate(userId: string): Promise<number> {
    const [totalInvestido, extratos] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          category: Category.investimento,
          extrato: { userId },
        },
        _sum: { amount: true },
      }),
      this.prisma.extrato.findMany({
        where: { userId, transactions: { some: {} } },
        select: { mesAno: true },
      }),
    ]);

    const distinctMonths = new Set(extratos.map((e) => e.mesAno)).size;
    if (distinctMonths === 0) {
      return 0;
    }

    const total =
      totalInvestido._sum.amount != null
        ? Number(totalInvestido._sum.amount)
        : 0;

    return total / distinctMonths;
  }

  /**
   * Enriches a goal with accumulated value, percentage and forecast.
   * Progress counts `investimento` transactions dated on or after the goal's
   * creation date (OQ-1, item 1). The forecast (OQ-1, item 2):
   * - goal already reached → date of the last contributing transaction;
   * - rate is zero → null (no pace to project from);
   * - otherwise → createdAt plus the whole months still needed.
   */
  private async enrichGoal(
    userId: string,
    goal: GoalRecord,
    mediaMensal: number,
  ): Promise<GoalWithProgressDto> {
    const contributions = await this.prisma.transaction.aggregate({
      where: {
        category: Category.investimento,
        date: { gte: goal.createdAt },
        extrato: { userId },
      },
      _sum: { amount: true },
      _max: { date: true },
    });

    const targetAmount = Number(goal.targetAmount);
    const valorAcumulado = GoalsService.round(
      contributions._sum.amount != null ? Number(contributions._sum.amount) : 0,
      2,
    );
    const percentual = GoalsService.round(
      Math.min(100, Math.max(0, (valorAcumulado / targetAmount) * 100)),
      2,
    );

    let previsaoConclusao: Date | null;
    if (valorAcumulado >= targetAmount) {
      // Goal reached — the forecast is the last contributing transaction.
      // `_max.date` is non-null whenever the goal is reached (a positive
      // sum implies at least one contributing transaction).
      previsaoConclusao = contributions._max.date;
    } else if (mediaMensal > 0) {
      const monthsRemaining = Math.ceil(
        (targetAmount - valorAcumulado) / mediaMensal,
      );
      previsaoConclusao = GoalsService.addMonths(
        goal.createdAt,
        monthsRemaining,
      );
    } else {
      previsaoConclusao = null;
    }

    return {
      id: goal.id,
      name: goal.name,
      targetAmount,
      deadline: goal.deadline,
      createdAt: goal.createdAt,
      valorAcumulado,
      percentual,
      previsaoConclusao,
    };
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

  private static round(n: number, decimals: number): number {
    const f = 10 ** decimals;
    return Math.round(n * f) / f;
  }

  private static addMonths(date: Date, months: number): Date {
    const result = new Date(date.getTime());
    result.setUTCMonth(result.getUTCMonth() + months);
    return result;
  }
}
