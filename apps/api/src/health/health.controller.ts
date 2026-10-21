import { Controller, Get } from '@nestjs/common';

export interface HealthResponse {
  readonly status: 'ok';
  readonly service: 'lovec-slev-api';
  readonly timestamp: string;
}

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: 'ok', service: 'lovec-slev-api', timestamp: new Date().toISOString() };
  }
}
