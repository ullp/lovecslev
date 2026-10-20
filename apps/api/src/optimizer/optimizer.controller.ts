import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { OptimizeRequestDto } from './dto/optimize-request.dto';
import { OptimizerService, type OptimizeResponse, type Plan } from './optimizer.service';

/** Do M3 nahrazuje `X-Plan` hlavičku reálný auth guard + `subscriptions.plan` (D19). */
function parsePlan(header: string | undefined): Plan {
  return header?.toUpperCase() === 'PREMIUM' ? 'PREMIUM' : 'FREE';
}

@Controller('v1/optimizer')
export class OptimizerController {
  constructor(private readonly optimizer: OptimizerService) {}

  /**
   * Dočasný bezstavový endpoint pro M0/M2 (bez DB).
   * V M3 ho nahradí `POST /v1/lists/:id/optimize` (spec §13.2) nad uloženým seznamem.
   */
  @Post('preview')
  @HttpCode(200)
  preview(@Body() dto: OptimizeRequestDto, @Headers('x-plan') planHeader?: string): OptimizeResponse {
    return this.optimizer.optimize(dto, parsePlan(planHeader));
  }
}
