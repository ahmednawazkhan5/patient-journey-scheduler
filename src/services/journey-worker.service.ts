import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { JourneyRun } from '../entities/journey-run.entity';
import { Journey } from '../entities/journey.entity';
import { JourneyRunStatus } from '../enums/journey-run-status.enum';
import { JourneyService } from './journey.service';

@Injectable()
export class JourneyWorkerService {
  private readonly logger = new Logger(JourneyWorkerService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly journeyService: JourneyService,
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
          await this.resumeJourney(runId);
        } catch (error) {
          this.logger.error(`Error processing journey ${runId}:`, error);
          await this.markJourneyFailed(runId);
        }
      }
    } catch (error) {
      this.logger.error('Error in processReadyJourneys:', error);
    }
  }

  /**
   * Resume a specific journey from where it left off
   */
  private async resumeJourney(runId: string) {
    this.logger.log(`Resuming journey run: ${runId}`);

    const journeyRun = await this.databaseService.findOne(JourneyRun, {
      where: { runId },
    });

    if (!journeyRun) {
      this.logger.error(`Journey run ${runId} not found`);
      return;
    }

    const journey = await this.databaseService.findOne(Journey, {
      where: { id: journeyRun.journeyId },
    });

    if (!journey) {
      this.logger.error(`Journey ${journeyRun.journeyId} not found`);
      await this.markJourneyFailed(runId);
      return;
    }

    // Find current node (should be the delay node)
    const currentNode = journey.nodes.find(
      (node) => node.id === journeyRun.currentNodeId,
    );

    if (!currentNode) {
      this.logger.error(
        `Current node ${journeyRun.currentNodeId} not found in journey ${journey.id}`,
      );
      await this.markJourneyFailed(runId);
      return;
    }

    if (currentNode.type === 'DELAY') {
      // Time has passed, move to next node
      const nextNodeId = currentNode.next_node_id;
      this.logger.log(
        `DELAY node ${currentNode.id} completed, moving to node: ${nextNodeId}`,
      );

      // Update current node and continue processing
      await this.updateJourneyRunStatus(
        runId,
        JourneyRunStatus.IN_PROGRESS,
        nextNodeId,
      );

      // Continue processing from next node
      await this.continueJourneyProcessing(runId, nextNodeId);
    } else {
      this.logger.warn(
        `Expected DELAY node but found ${currentNode.type}, continuing processing`,
      );
      await this.continueJourneyProcessing(runId, journeyRun.currentNodeId);
    }
  }

  /**
   * Continue processing a journey from a specific node
   */
  private async continueJourneyProcessing(
    runId: string,
    currentNodeId: string | null,
  ) {
    // Delegate to the main journey service for processing logic
    // We'll need to expose a method in JourneyService for this
    await this.journeyService.continueProcessingFromNode(runId, currentNodeId);
  }

  /**
   * Mark a journey as failed
   */
  private async markJourneyFailed(runId: string) {
    await this.updateJourneyRunStatus(runId, JourneyRunStatus.FAILED, null);
  }

  /**
   * Update journey run status
   */
  private async updateJourneyRunStatus(
    runId: string,
    status: JourneyRunStatus,
    currentNodeId: string | null,
  ) {
    await this.databaseService.save(JourneyRun, {
      runId,
      status,
      currentNodeId,
    });
  }

  /**
   * Recovery method to handle stuck journeys
   */
  async recoverStuckJourneys(timeoutMinutes: number = 10) {
    const timeoutTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    const result = await this.databaseService
      .createQueryBuilder()
      .update(JourneyRun)
      .set({
        status: JourneyRunStatus.WAITING_DELAY,
      })
      .where('status = :status', { status: JourneyRunStatus.IN_PROGRESS })
      .andWhere('updatedAt < :timeout', { timeout: timeoutTime })
      .andWhere('resumeAt IS NOT NULL') // Only recover delayed journeys
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.warn(`Recovered ${result.affected} stuck journeys`);
    }
  }
}
