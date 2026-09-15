import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

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
  @ApiOperation({ summary: 'Readiness probe including durable persistence' })
  async ready() {
    try {
      await this.prisma.ping();
      return {
        status: 'ready',
        persistence: this.prisma.isPostgres ? 'postgresql' : 'in-memory',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        persistence: 'postgresql',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
