import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get('live')
  @ApiOperation({ summary: 'Kubernetes-style liveness probe' })
  live() {
    return {
      status: 'ok',
      service: 'books-store-api',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Development readiness probe' })
  ready() {
    return {
      status: 'ready',
      persistence: 'in-memory',
      timestamp: new Date().toISOString(),
    };
  }
}
