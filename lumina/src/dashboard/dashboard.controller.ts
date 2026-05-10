import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DashboardService, DashboardSummary } from './dashboard.service';
import { DashboardSummaryQueryDto } from './dto/dashboard-summary.query';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async summary(
    @Query() query: DashboardSummaryQueryDto,
    @CurrentUser() currentUser: { clerkId: string },
  ): Promise<{ data: DashboardSummary }> {
    const data = await this.dashboardService.summary(
      currentUser.clerkId,
      query,
    );
    return { data };
  }
}
