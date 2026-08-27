import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateWorkerEnvironment } from './env.validation';
import { FixtureWorkerService } from './fixture-worker.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateWorkerEnvironment }),
  ],
  providers: [FixtureWorkerService],
})
export class WorkerModule {}
