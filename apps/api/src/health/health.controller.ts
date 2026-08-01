import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';

import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth() {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  async getReady() {
    const body = await this.healthService.getReadiness();
    if (body.status !== 'ok') {
      throw new HttpException(body, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return body;
  }
}
