import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { ClerkAuthGuard } from './common/guards/clerk-auth.guard';
import { IaModule } from './ia/ia.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [PrismaModule, UsersModule, IaModule],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ClerkAuthGuard,
    },
  ],
})
export class AppModule {}
