import { Controller, HttpStatus, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import type { UserDto } from './dto/user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('sync')
  async sync(
    @CurrentUser() currentUser: { clerkId: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ data: UserDto }> {
    const { user, created } = await this.usersService.sync(currentUser.clerkId);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return { data: user };
  }
}
