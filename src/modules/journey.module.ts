import { Module } from '@nestjs/common';
import { JourneyController } from '../controllers/journey.controller';
import { JourneyService } from '../services/journey.service';
import { JourneyExecutionService } from '../services/journey-execution.service';
import { JourneyWorkerService } from '../services/journey-worker.service';
import { NodeProcessorService } from '../services/node-processor.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [JourneyController],
  providers: [
    JourneyService,
    JourneyExecutionService,
    JourneyWorkerService,
    NodeProcessorService,
  ],
  exports: [JourneyService, JourneyExecutionService, JourneyWorkerService],
})
export class JourneyModule {}
