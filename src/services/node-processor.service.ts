import { Injectable, Logger } from '@nestjs/common';
import {
  PatientContext,
  JourneyNode,
  ActionNode,
  DelayNode,
  ConditionalNode,
} from '../interfaces/journey.interface';
import { JourneyRunStatus } from '../enums/journey-run-status.enum';
import { DatabaseService } from '../database/database.service';
import { JourneyRun } from '../entities/journey-run.entity';
import { NodeType } from '../enums/node-type.enum';

@Injectable()
export class NodeProcessorService {
  private readonly logger = new Logger(NodeProcessorService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Process a node and return the next node ID
   */
  processNode(
    node: JourneyNode,
    patientContext: PatientContext,
  ): string | null {
    switch (node.type) {
      case NodeType.MESSAGE:
        return this.processMessageNode(node, patientContext);
      case NodeType.DELAY:
        return this.processDelayNode(node);
      case NodeType.CONDITIONAL:
        return this.processConditionalNode(node, patientContext);
      default:
        this.logger.error(`Unknown node type`);
        return null;
    }
  }

  /**
   * Process a MESSAGE node
   */
  private processMessageNode(
    node: ActionNode,
    patientContext: PatientContext,
  ): string | null {
    this.logger.log(
      `MESSAGE node ${node.id}: Sent message to patient ${patientContext.id}`,
    );

    return node.next_node_id;
  }

  /**
   * Process a DELAY node
   */
  private processDelayNode(node: DelayNode): string | null {
    // Don't actually delay here - just return the next node
    // The delay scheduling is handled in the journey service
    this.logger.log(
      `DELAY node ${node.id}: Scheduling delay for ${node.duration_seconds} seconds`,
    );

    return node.next_node_id;
  }

  /**
   * Process a CONDITIONAL node
   */
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

  /**
   * Get field value from patient context with dot notation support
   */
  private getFieldValue(patientContext: PatientContext, field: string): any {
    // Support dot notation like 'patient.age' or 'patient.nonexistent.field'
    const fieldParts = field.split('.');
    let value: any = patientContext;

    for (const part of fieldParts) {
      if (value == null || typeof value !== 'object') {
        return undefined;
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      value = value[part];
    }

    return value;
  }

  /**
   * Evaluate a condition based on operator
   */
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

  /**
   * Handle delay node scheduling
   */
  async handleDelayNode(runId: string, delayNode: DelayNode): Promise<void> {
    const resumeTime = new Date(Date.now() + delayNode.duration_seconds * 1000);

    await this.databaseService.save(JourneyRun, {
      runId,
      status: JourneyRunStatus.WAITING_DELAY,
      currentNodeId: delayNode.id,
      resumeAt: resumeTime,
    });

    this.logger.log(
      `DELAY node ${delayNode.id}: Scheduled resume at ${resumeTime.toISOString()}`,
    );
  }
}
