import { Module } from '@nestjs/common';
import { JourneyController } from '../controllers/journey.controller';
import { JourneyService } from '../services/journey.service';
import { JourneyWorkerService } from '../services/journey-worker.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [JourneyController],
  providers: [JourneyService, JourneyWorkerService],
  exports: [JourneyService, JourneyWorkerService],
})
export class JourneyModule {}
