import { Module } from '@nestjs/common';
import { JourneyController } from '../controllers/journey.controller';
import { JourneyService } from '../services/journey.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [JourneyController],
  providers: [JourneyService],
  exports: [JourneyService],
})
export class JourneyModule {}
