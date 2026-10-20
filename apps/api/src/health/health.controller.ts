import { Controller, Get } from '@nestjs/common';

export interface HealthResponse {
  readonly status: 'ok';
  readonly service: 'slevari-api';
  readonly timestamp: string;
}

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: 'ok', service: 'slevari-api', timestamp: new Date().toISOString() };
  }
}
