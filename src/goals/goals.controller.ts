import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateGoalDto } from './dto/create-goal.dto';
import { GoalDto, GoalsService } from './goals.service';

@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateGoalDto,
    @CurrentUser() currentUser: { clerkId: string },
  ): Promise<{ data: GoalDto }> {
    const data = await this.goalsService.create(currentUser.clerkId, dto);
    return { data };
  }

  @Get()
  async list(
    @CurrentUser() currentUser: { clerkId: string },
  ): Promise<{ data: GoalDto[] }> {
    const data = await this.goalsService.list(currentUser.clerkId);
    return { data };
  }
}
