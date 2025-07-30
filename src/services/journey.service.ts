import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { Journey } from '../entities/journey.entity';
import { JourneyRun } from '../entities/journey-run.entity';
import { JourneyRunStatus } from '../enums/journey-run-status.enum';
import {
  Journey as IJourney,
  PatientContext,
  JourneyNode,
  ActionNode,
  DelayNode,
  ConditionalNode,
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

  async triggerJourney(
    journeyId: string,
    patientContext: PatientContext,
  ): Promise<string> {
    // Check if journey exists
    const journey = await this.databaseService.findOne(Journey, {
      where: { id: journeyId },
    });

    if (!journey) {
      throw new NotFoundException(`Journey with ID ${journeyId} not found`);
    }

    // Create a new journey run
    const journeyRun = new JourneyRun();
    journeyRun.runId = uuidv4();
    journeyRun.journeyId = journeyId;
    journeyRun.status = JourneyRunStatus.IN_PROGRESS;
    journeyRun.currentNodeId = journey.start_node_id;
    journeyRun.patientContext = patientContext;

    await this.databaseService.save(JourneyRun, journeyRun);
    this.logger.log(`Started journey run with ID: ${journeyRun.runId}`);

    // Start processing the journey asynchronously
    this.processJourney(journeyRun.runId).catch((error) => {
      this.logger.error(
        `Error processing journey run ${journeyRun.runId}:`,
        error,
      );
    });

    return journeyRun.runId;
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

  private async processJourney(runId: string): Promise<void> {
    const journeyRun = await this.getJourneyRun(runId);
    const journey = await this.databaseService.findOne(Journey, {
      where: { id: journeyRun.journeyId },
    });

    if (!journey) {
      await this.updateJourneyRunStatus(runId, JourneyRunStatus.FAILED, null);
      return;
    }

    let currentNodeId = journeyRun.currentNodeId;

    while (currentNodeId) {
      const currentNode = journey.nodes.find(
        (node) => node.id === currentNodeId,
      );

      if (!currentNode) {
        this.logger.error(
          `Node ${currentNodeId} not found in journey ${journey.id}`,
        );
        await this.updateJourneyRunStatus(
          runId,
          JourneyRunStatus.FAILED,
          currentNodeId,
        );
        return;
      }

      const nextNodeId = await this.processNode(
        currentNode,
        journeyRun.patientContext,
      );

      // Update the current node
      await this.updateJourneyRunStatus(
        runId,
        JourneyRunStatus.IN_PROGRESS,
        nextNodeId,
      );
      currentNodeId = nextNodeId;
    }

    // Journey completed
    await this.updateJourneyRunStatus(runId, JourneyRunStatus.COMPLETED, null);
    this.logger.log(`Journey run ${runId} completed`);
  }

  private async processNode(
    node: JourneyNode,
    patientContext: PatientContext,
  ): Promise<string | null> {
    switch (node.type) {
      case 'MESSAGE':
        return this.processMessageNode(node, patientContext);
      case 'DELAY':
        return this.processDelayNode(node);
      case 'CONDITIONAL':
        return this.processConditionalNode(node, patientContext);
      default:
        this.logger.error(`Unknown node type`);
        return null;
    }
  }

  private processMessageNode(
    node: ActionNode,
    patientContext: PatientContext,
  ): string | null {
    this.logger.log(
      `MESSAGE node ${node.id}: Sent message to patient ${patientContext.id}`,
    );

    return node.next_node_id;
  }

  private async processDelayNode(node: DelayNode): Promise<string | null> {
    this.logger.log(
      `DELAY node ${node.id}: Waiting for ${node.duration_seconds} seconds`,
    );

    // Create a delay
    await new Promise((resolve) =>
      setTimeout(resolve, node.duration_seconds * 1000),
    );

    this.logger.log(`DELAY node ${node.id}: Delay completed`);
    return node.next_node_id;
  }

  private processConditionalNode(
    node: ConditionalNode,
    patientContext: PatientContext,
  ): string | null {
    const condition = node.condition;
    const field = condition.field;
    const operator = condition.operator;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const value = condition.value;

    // Get the field value from patient context
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const fieldValue = this.getFieldValue(patientContext, field);

    // Evaluate the condition
    const conditionResult = this.evaluateCondition(fieldValue, operator, value);

    this.logger.log(
      `CONDITIONAL node ${node.id}: ${field} ${operator} ${value} = ${conditionResult}`,
    );

    return conditionResult
      ? node.on_true_next_node_id
      : node.on_false_next_node_id;
  }

  private getFieldValue(patientContext: PatientContext, field: string): any {
    // Support dot notation like 'patient.age'
    const fieldPath = field.startsWith('patient.') ? field.substring(8) : field;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return (patientContext as any)[fieldPath];
  }

  private evaluateCondition(
    fieldValue: any,
    operator: string,
    value: any,
  ): boolean {
    switch (operator) {
      case '>':
        return fieldValue > value;
      case '<':
        return fieldValue < value;
      case '>=':
        return fieldValue >= value;
      case '<=':
        return fieldValue <= value;
      case '=':
      case '==':
        return fieldValue === value;
      case '!=':
        return fieldValue !== value;
      default:
        this.logger.error(`Unknown operator: ${operator}`);
        return false;
    }
  }

  private async updateJourneyRunStatus(
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
