import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PricingService } from './pricing.service';

@ApiTags('pricing')
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get('policy')
  @ApiOperation({ summary: 'Return the active public pricing rule' })
  getPolicy(): Record<string, number | string> {
    return this.pricing.getPublicPolicy();
  }
}
