import { Query, Resolver } from '@nestjs/graphql';
import { HealthService } from './health.service';

@Resolver()
export class HealthResolver {
  constructor(private readonly healthService: HealthService) {}

  @Query(() => String, { name: 'health' })
  health(): string {
    return this.healthService.getLivenessStatus();
  }
}
