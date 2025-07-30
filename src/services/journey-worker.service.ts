import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { JourneyRun } from '../entities/journey-run.entity';
import { JourneyRunStatus } from '../enums/journey-run-status.enum';
import { JourneyExecutionService } from './journey-execution.service';

@Injectable()
export class JourneyWorkerService {
  private readonly logger = new Logger(JourneyWorkerService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly journeyExecutionService: JourneyExecutionService,
  ) {}

  /**
   * Start the worker to poll for ready journeys
   */
  startWorker(intervalMs: number = 5000) {
    if (this.isRunning) {
      this.logger.warn('Worker is already running');
      return;
    }

    this.isRunning = true;
    this.logger.log(`Starting journey worker with ${intervalMs}ms interval`);

    this.intervalId = setInterval(() => {
      this.processReadyJourneys().catch((error) => {
        this.logger.error('Error in worker processing:', error);
      });
    }, intervalMs);
  }

  /**
   * Stop the worker
   */
  stopWorker() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.logger.log('Journey worker stopped');
  }

  /**
   * Process all journeys that are ready to resume
   */
  async processReadyJourneys() {
    const batchSize = 1000; // can be configurable based on load

    try {
      // Step 1: Lock and claim journeys atomically
      const claimedJourneyIds = await this.databaseService.transaction(
        async (manager) => {
          // Find ready journeys with row locking
          const readyJourneys = await manager
            .createQueryBuilder(JourneyRun, 'jr')
            .where('jr.status = :status', {
              status: JourneyRunStatus.WAITING_DELAY,
            })
            .andWhere('jr.resumeAt <= :now', { now: new Date() })
            .orderBy('jr.resumeAt', 'ASC') // Process oldest first
            .limit(batchSize)
            .setLock('pessimistic_write') // FOR UPDATE
            .getMany();

          if (readyJourneys.length === 0) {
            return []; // Nothing to process
          }

          this.logger.log(
            `Found ${readyJourneys.length} journeys ready to resume`,
          );

          // Immediately claim them by changing status
          const claimedIds: string[] = [];
          for (const journey of readyJourneys) {
            journey.status = JourneyRunStatus.IN_PROGRESS;
            journey.resumeAt = null; // Clear resume time
            await manager.save(journey);
            claimedIds.push(journey.runId);
          }

          return claimedIds;
          // Transaction commits → locks released automatically
        },
      );

      // Step 2: Process journeys without holding any locks
      for (const runId of claimedJourneyIds) {
        try {
          await this.journeyExecutionService.resumeJourney(runId);
        } catch (error) {
          this.logger.error(`Error processing journey ${runId}:`, error);
          // Note: We'll need to add updateJourneyRunStatus to JourneyService or handle this differently
        }
      }
    } catch (error) {
      this.logger.error('Error in processReadyJourneys:', error);
    }
  }
}
