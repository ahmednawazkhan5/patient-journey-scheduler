import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { JourneyRun } from '../entities/journey-run.entity';
import { Journey } from '../entities/journey.entity';
import { JourneyRunStatus } from '../enums/journey-run-status.enum';
import { PatientContext } from '../interfaces/journey.interface';
import { NodeProcessorService } from './node-processor.service';
import { JourneyService } from './journey.service';
import { NodeType } from '../enums/node-type.enum';
import { DatabaseService } from '../database/database.service';

/**
 * Journey context containing all necessary data for processing
 */
interface JourneyContext {
  journeyRun: JourneyRun;
  journey: Journey;
}

@Injectable()
export class JourneyExecutionService {
  private readonly logger = new Logger(JourneyExecutionService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly nodeProcessorService: NodeProcessorService,
    private readonly journeyService: JourneyService,
  ) {}

  /**
   * Trigger a new journey execution
   */
  async triggerJourney(
    journeyId: string,
    patientContext: PatientContext,
  ): Promise<string> {
    // Get and validate journey exists
    const journey = await this.journeyService.getJourney(journeyId);

    // Create a new journey run
    const journeyRun = new JourneyRun();
    journeyRun.runId = uuidv4();
    journeyRun.journeyId = journeyId;
    journeyRun.status = JourneyRunStatus.IN_PROGRESS;
    journeyRun.currentNodeId = journey.start_node_id;
    journeyRun.patientContext = patientContext;
    journeyRun.resumeAt = null;

    await this.databaseService.save(JourneyRun, journeyRun);
    this.logger.log(`Started journey run with ID: ${journeyRun.runId}`);

    // Start processing the journey immediately (non-blocking)
    this.processJourneyFromNode(
      journeyRun.runId,
      journeyRun.currentNodeId,
    ).catch((error) => {
      this.logger.error(
        `Error processing journey run ${journeyRun.runId}:`,
        error,
      );
    });

    return journeyRun.runId;
  }

  /**
   * Resume a specific journey from where it left off
   */
  async resumeJourney(runId: string): Promise<void> {
    this.logger.log(`Resuming journey run: ${runId}`);

    const context = await this.getJourneyContext(runId);
    if (!context) {
      return; // Error already logged in getJourneyContext
    }

    const { journeyRun, journey } = context;

    if (!journeyRun.currentNodeId) {
      await this.journeyService.failJourney(runId, 'No current node ID found');
      return;
    }

    const currentNode = this.journeyService.findNodeInJourney(
      journey,
      journeyRun.currentNodeId,
    );

    if (!currentNode) {
      await this.journeyService.failJourney(
        runId,
        `Current node ${journeyRun.currentNodeId} not found in journey ${journey.id}`,
      );
      return;
    }

    if (currentNode.type === NodeType.DELAY) {
      // Time has passed, move to next node
      const nextNodeId = currentNode.next_node_id;
      this.logger.log(
        `DELAY node ${currentNode.id} completed, moving to node: ${nextNodeId}`,
      );

      // Update current node and continue processing
      await this.journeyService.updateJourneyRunStatus(
        runId,
        JourneyRunStatus.IN_PROGRESS,
        nextNodeId,
      );

      // Continue processing from next node
      await this.processJourneyFromNode(runId, nextNodeId);
    } else {
      this.logger.warn(
        `Expected DELAY node but found ${currentNode.type}, continuing processing`,
      );
      await this.processJourneyFromNode(runId, journeyRun.currentNodeId);
    }
  }

  /**
   * Process journey starting from a specific node
   */
  private async processJourneyFromNode(
    runId: string,
    startNodeId: string | null,
  ): Promise<void> {
    if (!startNodeId) {
      await this.journeyService.completeJourney(runId);
      return;
    }

    const context = await this.getJourneyContext(runId);
    if (!context) {
      return; // Error already logged in getJourneyContext
    }

    await this.executeJourneyLoop(context, startNodeId);
  }

  /**
   * Execute the main journey processing loop
   */
  private async executeJourneyLoop(
    context: JourneyContext,
    startNodeId: string,
  ): Promise<void> {
    const { journeyRun, journey } = context;
    let currentNodeId: string | null = startNodeId;

    while (currentNodeId) {
      const currentNode = this.journeyService.findNodeInJourney(
        journey,
        currentNodeId,
      );

      if (!currentNode) {
        await this.journeyService.failJourney(
          journeyRun.runId,
          `Node ${currentNodeId} not found in journey ${journey.id}`,
        );
        return;
      }

      const nextNodeId = this.nodeProcessorService.processNode(
        currentNode,
        journeyRun.patientContext,
      );

      // Handle delay nodes specially
      if (currentNode.type === NodeType.DELAY && nextNodeId) {
        await this.nodeProcessorService.handleDelayNode(
          journeyRun.runId,
          currentNode,
        );
        return; // Exit processing - worker will resume later
      }

      // Update current node for non-delay nodes
      await this.journeyService.updateJourneyRunStatus(
        journeyRun.runId,
        JourneyRunStatus.IN_PROGRESS,
        nextNodeId,
      );

      if (nextNodeId === null) {
        break; // Journey completed
      }

      currentNodeId = nextNodeId;
    }

    // Journey completed
    await this.journeyService.completeJourney(journeyRun.runId);
  }

  /**
   * Get complete journey context with validation
   */
  private async getJourneyContext(
    runId: string,
  ): Promise<JourneyContext | null> {
    const journeyRun = await this.journeyService.getJourneyRun(runId);
    if (!journeyRun) {
      this.logger.error(`Journey run not found: ${runId}`);
      return null;
    }

    const journey = await this.journeyService.getJourney(journeyRun.journeyId);
    if (!journey) {
      this.logger.error(`Journey not found: ${journeyRun.journeyId}`);
      return null;
    }

    return { journeyRun, journey };
  }
}
