import { Injectable } from '@nestjs/common';
import { Category, TransactionType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { DashboardSummaryQueryDto } from './dto/dashboard-summary.query';

export interface PieChartEntry {
  categoria: Category;
  valor: number;
  percentual: number;
}

export interface CategoryTotal {
  categoria: Category;
  valor: number;
}

export interface DashboardSummary {
  mesAno: string;
  totalGasto: number;
  categoriaMaior: CategoryTotal | null;
  variacaoVsMesAnterior: number | null;
  pieChart: PieChartEntry[];
}

export interface HistoryEntry {
  mesAno: string;
  totalGasto: number;
}

export interface DashboardHistory {
  history: HistoryEntry[];
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async summary(
    clerkId: string,
    query: DashboardSummaryQueryDto,
  ): Promise<DashboardSummary> {
    const userId = await this.usersService.resolveUserId(clerkId);
    const mesAno = query.mesAno ?? DashboardService.currentMesAno();
    const previousMesAno = DashboardService.previousMesAno(mesAno);

    const extratoBase = {
      userId,
      ...(query.banco ? { banco: query.banco } : {}),
    };

    const grouped = await this.prisma.transaction.groupBy({
      by: ['category'],
      where: {
        type: TransactionType.debit,
        extrato: { ...extratoBase, mesAno },
      },
      _sum: { amount: true },
    });

    const previousAggregate = await this.prisma.transaction.aggregate({
      where: {
        type: TransactionType.debit,
        extrato: { ...extratoBase, mesAno: previousMesAno },
      },
      _sum: { amount: true },
    });

    const categoryTotals: CategoryTotal[] = grouped
      .map((row) => ({
        categoria: row.category,
        valor:
          row._sum.amount != null
            ? DashboardService.round(Number(row._sum.amount), 2)
            : 0,
      }))
      .filter((row) => row.valor > 0);

    const totalGasto = DashboardService.round(
      categoryTotals.reduce((acc, r) => acc + r.valor, 0),
      2,
    );

    const pieChart = DashboardService.buildPieChart(categoryTotals, totalGasto);

    const categoriaMaior =
      categoryTotals.length === 0
        ? null
        : categoryTotals.reduce((max, r) => (r.valor > max.valor ? r : max));

    const previousTotal =
      previousAggregate._sum.amount != null
        ? Number(previousAggregate._sum.amount)
        : 0;
    const variacaoVsMesAnterior =
      previousTotal > 0
        ? DashboardService.round(
            ((totalGasto - previousTotal) / previousTotal) * 100,
            2,
          )
        : null;

    return {
      mesAno,
      totalGasto,
      categoriaMaior,
      variacaoVsMesAnterior,
      pieChart,
    };
  }

  async history(clerkId: string): Promise<DashboardHistory> {
    const userId = await this.usersService.resolveUserId(clerkId);
    const months = DashboardService.lastSixMesAnos();

    const aggregates = await Promise.all(
      months.map((mesAno) =>
        this.prisma.transaction.aggregate({
          where: {
            type: TransactionType.debit,
            extrato: { userId, mesAno },
          },
          _sum: { amount: true },
        }),
      ),
    );

    const history: HistoryEntry[] = months.map((mesAno, i) => ({
      mesAno,
      totalGasto:
        aggregates[i]._sum.amount != null
          ? DashboardService.round(Number(aggregates[i]._sum.amount), 2)
          : 0,
    }));

    return { history };
  }

  private static buildPieChart(
    rows: CategoryTotal[],
    totalGasto: number,
  ): PieChartEntry[] {
    if (totalGasto === 0 || rows.length === 0) return [];

    const entries: PieChartEntry[] = rows.map((r) => ({
      categoria: r.categoria,
      valor: r.valor,
      percentual: DashboardService.round((r.valor / totalGasto) * 100, 2),
    }));

    const sum = entries.reduce((acc, r) => acc + r.percentual, 0);
    const diff = DashboardService.round(100 - sum, 2);
    if (diff !== 0) {
      const largestIdx = entries.reduce(
        (maxIdx, r, i) => (r.valor > entries[maxIdx].valor ? i : maxIdx),
        0,
      );
      entries[largestIdx].percentual = DashboardService.round(
        entries[largestIdx].percentual + diff,
        2,
      );
    }

    return entries;
  }

  private static round(n: number, decimals: number): number {
    const f = 10 ** decimals;
    return Math.round(n * f) / f;
  }

  private static currentMesAno(): string {
    const now = new Date();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${now.getUTCFullYear()}-${month}`;
  }

  private static previousMesAno(mesAno: string): string {
    const [yearStr, monthStr] = mesAno.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  }

  private static lastSixMesAnos(): string[] {
    const months: string[] = [];
    let mesAno = DashboardService.currentMesAno();
    for (let i = 0; i < 6; i++) {
      months.unshift(mesAno);
      mesAno = DashboardService.previousMesAno(mesAno);
    }
    return months;
  }
}
