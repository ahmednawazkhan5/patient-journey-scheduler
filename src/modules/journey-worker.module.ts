import { Module } from '@nestjs/common';
import { JourneyWorkerService } from '../services/journey-worker.service';
import { DatabaseModule } from '../database/database.module';
import { JourneyService } from '../services/journey.service';
import { JourneyExecutionService } from '../services/journey-execution.service';
import { NodeProcessorService } from '../services/node-processor.service';

@Module({
  imports: [DatabaseModule],
  providers: [
    JourneyWorkerService,
    JourneyService,
    JourneyExecutionService,
    NodeProcessorService,
  ],
  exports: [JourneyWorkerService],
})
export class JourneyWorkerModule {}
