import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * Exposes `GET /health`. Has no service — the endpoint carries no
 * business logic, only an infrastructure liveness signal.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
