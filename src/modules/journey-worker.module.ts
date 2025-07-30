import { Module } from '@nestjs/common';
import { JourneyWorkerService } from '../services/journey-worker.service';
import { DatabaseModule } from '../database/database.module';
import { JourneyService } from '../services/journey.service';

@Module({
  imports: [DatabaseModule],
  providers: [JourneyWorkerService, JourneyService],
  exports: [JourneyWorkerService],
})
export class JourneyWorkerModule {}
