import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { Journey } from '../entities/journey.entity';
import { JourneyRun } from '../entities/journey-run.entity';
import { JourneyRunStatus } from '../enums/journey-run-status.enum';
import {
  Journey as IJourney,
  JourneyNode,
} from '../interfaces/journey.interface';

@Injectable()
export class JourneyService {
  private readonly logger = new Logger(JourneyService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async createJourney(journeyData: Omit<IJourney, 'id'>): Promise<string> {
    const journey = new Journey();
    journey.id = uuidv4();
    journey.name = journeyData.name;
    journey.start_node_id = journeyData.start_node_id;
    journey.nodes = journeyData.nodes;

    await this.databaseService.save(Journey, journey);
    this.logger.log(`Created journey with ID: ${journey.id}`);

    return journey.id;
  }

  async getJourney(journeyId: string): Promise<Journey> {
    const journey = await this.databaseService.findOne(Journey, {
      where: { id: journeyId },
    });

    if (!journey) {
      throw new NotFoundException(`Journey with ID ${journeyId} not found`);
    }

    return journey;
  }

  async getJourneyRun(runId: string): Promise<JourneyRun> {
    const journeyRun = await this.databaseService.findOne(JourneyRun, {
      where: { runId },
    });

    if (!journeyRun) {
      throw new NotFoundException(`Journey run with ID ${runId} not found`);
    }

    return journeyRun;
  }

  /**
   * Find a node in the journey by ID
   */
  findNodeInJourney(journey: Journey, nodeId: string): JourneyNode | null {
    return journey.nodes.find((node) => node.id === nodeId) || null;
  }

  /**
   * Complete a journey with proper logging and status update
   */
  async completeJourney(runId: string): Promise<void> {
    await this.updateJourneyRunStatus(runId, JourneyRunStatus.COMPLETED, null);
    this.logger.log(`Journey run ${runId} completed`);
  }

  /**
   * Fail a journey with proper logging and status update
   */
  async failJourney(runId: string, reason: string): Promise<void> {
    await this.updateJourneyRunStatus(runId, JourneyRunStatus.FAILED, null);
    this.logger.error(`Journey run ${runId} failed: ${reason}`);
  }

  async updateJourneyRunStatus(
    runId: string,
    status: JourneyRunStatus,
    currentNodeId: string | null,
  ): Promise<void> {
    await this.databaseService.save(JourneyRun, {
      runId,
      status,
      currentNodeId,
    });
  }
}
