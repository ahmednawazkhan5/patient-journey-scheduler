import { NodeType } from '../../src/enums/node-type.enum';
import { JourneyRunStatus } from '../../src/enums/journey-run-status.enum';
import {
  Journey,
  PatientContext,
  ActionNode,
  DelayNode,
  ConditionalNode,
} from '../../src/interfaces/journey.interface';
import { JourneyRun } from '../../src/entities/journey-run.entity';
import { Journey as JourneyEntity } from '../../src/entities/journey.entity';

/**
 * Test data fixtures for consistent testing
 */
export class TestFixtures {
  /**
   * Sample patient contexts for different test scenarios
   */
  static readonly PATIENT_CONTEXTS = {
    SENIOR_PATIENT: {
      id: 'patient-senior-123',
      age: 72,
      language: 'en',
      condition: 'hip_replacement',
    } as PatientContext,

    YOUNG_PATIENT: {
      id: 'patient-young-456',
      age: 45,
      language: 'es',
      condition: 'knee_replacement',
    } as PatientContext,

    ELDERLY_PATIENT: {
      id: 'patient-elderly-789',
      age: 85,
      language: 'en',
      condition: 'hip_replacement',
    } as PatientContext,
  };

  /**
   * Individual test nodes for focused node processing tests
   */
  static readonly TEST_NODES = {
    MESSAGE: {
      BASIC: {
        id: 'msg-basic',
        type: NodeType.MESSAGE,
        message: 'Welcome to your journey',
        next_node_id: 'next-step',
      } as ActionNode,

      FINAL: {
        id: 'msg-final',
        type: NodeType.MESSAGE,
        message: 'Journey completed!',
        next_node_id: null,
      } as ActionNode,
    },

    DELAY: {
      SHORT: {
        id: 'delay-short',
        type: NodeType.DELAY,
        duration_seconds: 300, // 5 minutes
        next_node_id: 'after-delay',
      } as DelayNode,

      LONG: {
        id: 'delay-long',
        type: NodeType.DELAY,
        duration_seconds: 86400, // 24 hours
        next_node_id: 'next-day',
      } as DelayNode,

      FINAL: {
        id: 'delay-final',
        type: NodeType.DELAY,
        duration_seconds: 60,
        next_node_id: null,
      } as DelayNode,
    },

    CONDITIONAL: {
      AGE_SENIOR: {
        id: 'cond-age-senior',
        type: NodeType.CONDITIONAL,
        condition: {
          field: 'age',
          operator: '>=',
          value: 65,
        },
        on_true_next_node_id: 'senior-path',
        on_false_next_node_id: 'standard-path',
      } as ConditionalNode,

      LANGUAGE_EN: {
        id: 'cond-lang-en',
        type: NodeType.CONDITIONAL,
        condition: {
          field: 'language',
          operator: '=',
          value: 'en',
        },
        on_true_next_node_id: 'english-content',
        on_false_next_node_id: 'spanish-content',
      } as ConditionalNode,

      NESTED_FIELD: {
        id: 'cond-nested',
        type: NodeType.CONDITIONAL,
        condition: {
          field: 'demographics.age',
          operator: '>',
          value: 60,
        },
        on_true_next_node_id: 'senior-care',
        on_false_next_node_id: 'standard-care',
      } as ConditionalNode,

      INVALID_OPERATOR: {
        id: 'cond-invalid',
        type: NodeType.CONDITIONAL,
        condition: {
          field: 'age',
          operator: 'invalid_op',
          value: 50,
        },
        on_true_next_node_id: 'true-path',
        on_false_next_node_id: 'false-path',
      } as ConditionalNode,
    },
  };

  // Add a patient with nested fields for complex conditional testing
  static readonly COMPLEX_NESTED_PATIENT = {
    id: 'patient-complex-999',
    demographics: {
      age: 65,
      gender: 'female',
    },
    medical: {
      condition: 'hip_replacement',
      severity: 'moderate',
    },
    preferences: {
      language: 'en',
    },
  } as unknown as PatientContext;

  /**
   * Sample journey definitions for different test scenarios
   */
  static readonly JOURNEYS = {
    LINEAR_JOURNEY: {
      name: 'Linear Recovery Journey',
      start_node_id: 'welcome',
      nodes: [
        {
          id: 'welcome',
          type: NodeType.MESSAGE,
          message: 'Welcome to your recovery',
          next_node_id: 'reminder',
        },
        {
          id: 'reminder',
          type: NodeType.MESSAGE,
          message: 'Take your medication',
          next_node_id: 'completion',
        },
        {
          id: 'completion',
          type: NodeType.MESSAGE,
          message: 'Recovery complete!',
          next_node_id: null,
        },
      ],
    } as Omit<Journey, 'id'>,

    CONDITIONAL_JOURNEY: {
      name: 'Age-Based Recovery Journey',
      start_node_id: 'welcome',
      nodes: [
        {
          id: 'welcome',
          type: NodeType.MESSAGE,
          message: 'Welcome to recovery',
          next_node_id: 'age-check',
        },
        {
          id: 'age-check',
          type: NodeType.CONDITIONAL,
          condition: {
            field: 'age',
            operator: '>',
            value: 65,
          },
          on_true_next_node_id: 'senior-care',
          on_false_next_node_id: 'standard-care',
        },
        {
          id: 'senior-care',
          type: NodeType.MESSAGE,
          message: 'Senior-specific care instructions',
          next_node_id: null,
        },
        {
          id: 'standard-care',
          type: NodeType.MESSAGE,
          message: 'Standard care instructions',
          next_node_id: null,
        },
      ],
    } as Omit<Journey, 'id'>,

    DELAY_JOURNEY: {
      name: 'Recovery with Delays',
      start_node_id: 'start',
      nodes: [
        {
          id: 'start',
          type: NodeType.MESSAGE,
          message: 'Starting recovery',
          next_node_id: 'wait-1hour',
        },
        {
          id: 'wait-1hour',
          type: NodeType.DELAY,
          duration_seconds: 3600,
          next_node_id: 'checkup',
        },
        {
          id: 'checkup',
          type: NodeType.MESSAGE,
          message: 'Time for your checkup',
          next_node_id: null,
        },
      ],
    } as Omit<Journey, 'id'>,

    COMPLEX_JOURNEY: {
      name: 'Complex Multi-Path Journey',
      start_node_id: 'initial',
      nodes: [
        {
          id: 'initial',
          type: NodeType.MESSAGE,
          message: 'Starting your journey',
          next_node_id: 'language-check',
        },
        {
          id: 'language-check',
          type: NodeType.CONDITIONAL,
          condition: {
            field: 'language',
            operator: '=',
            value: 'es',
          },
          on_true_next_node_id: 'spanish-path',
          on_false_next_node_id: 'english-path',
        },
        {
          id: 'spanish-path',
          type: NodeType.MESSAGE,
          message: 'Bienvenido a su recuperación',
          next_node_id: 'delay-spanish',
        },
        {
          id: 'english-path',
          type: NodeType.MESSAGE,
          message: 'Welcome to your recovery',
          next_node_id: 'delay-english',
        },
        {
          id: 'delay-spanish',
          type: NodeType.DELAY,
          duration_seconds: 1800,
          next_node_id: 'final-spanish',
        },
        {
          id: 'delay-english',
          type: NodeType.DELAY,
          duration_seconds: 1800,
          next_node_id: 'final-english',
        },
        {
          id: 'final-spanish',
          type: NodeType.MESSAGE,
          message: 'Recuperación completa',
          next_node_id: null,
        },
        {
          id: 'final-english',
          type: NodeType.MESSAGE,
          message: 'Recovery complete',
          next_node_id: null,
        },
      ],
    } as Omit<Journey, 'id'>,
  };

  /**
   * Create full Journey entities with IDs for testing
   */
  static createMockJourneyEntity(
    journeyTemplate: Omit<Journey, 'id'>,
    id = 'test-journey-123',
  ): JourneyEntity {
    const journey = new JourneyEntity();
    journey.id = id;
    journey.name = journeyTemplate.name;
    journey.start_node_id = journeyTemplate.start_node_id;
    journey.nodes = journeyTemplate.nodes;
    return journey;
  }

  /**
   * Create commonly used Journey entities
   */
  static readonly JOURNEY_ENTITIES = {
    LINEAR: () =>
      TestFixtures.createMockJourneyEntity(
        TestFixtures.JOURNEYS.LINEAR_JOURNEY,
        'linear-journey-123',
      ),
    CONDITIONAL: () =>
      TestFixtures.createMockJourneyEntity(
        TestFixtures.JOURNEYS.CONDITIONAL_JOURNEY,
        'conditional-journey-123',
      ),
    DELAY: () =>
      TestFixtures.createMockJourneyEntity(
        TestFixtures.JOURNEYS.DELAY_JOURNEY,
        'delay-journey-123',
      ),
    COMPLEX: () =>
      TestFixtures.createMockJourneyEntity(
        TestFixtures.JOURNEYS.COMPLEX_JOURNEY,
        'complex-journey-123',
      ),
  };

  /**
   * Create a mock JourneyRun with default values and optional overrides
   */
  static createMockJourneyRun(overrides: Partial<JourneyRun> = {}): JourneyRun {
    const journeyRun = new JourneyRun();
    journeyRun.runId = 'test-run-123';
    journeyRun.journeyId = 'test-journey-456';
    journeyRun.status = JourneyRunStatus.IN_PROGRESS;
    journeyRun.currentNodeId = 'welcome';
    journeyRun.patientContext = TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT;
    journeyRun.resumeAt = null;
    journeyRun.createdAt = new Date('2025-07-30T10:00:00Z');
    journeyRun.updatedAt = new Date('2025-07-30T10:00:00Z');

    return Object.assign(journeyRun, overrides);
  }

  /**
   * Create multiple journey runs for testing bulk operations
   */
  static createMultipleJourneyRuns(count: number): JourneyRun[] {
    return Array.from({ length: count }, (_, index) =>
      TestFixtures.createMockJourneyRun({
        runId: `test-run-${index + 1}`,
        journeyId: `test-journey-${index + 1}`,
        patientContext: {
          ...TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT,
          id: `patient-${index + 1}`,
        },
      }),
    );
  }

  /**
   * Create journey runs in different statuses for testing
   */
  static createJourneyRunsWithStatuses(): Record<JourneyRunStatus, JourneyRun> {
    return {
      [JourneyRunStatus.IN_PROGRESS]: TestFixtures.createMockJourneyRun({
        status: JourneyRunStatus.IN_PROGRESS,
        runId: 'run-in-progress',
      }),
      [JourneyRunStatus.COMPLETED]: TestFixtures.createMockJourneyRun({
        status: JourneyRunStatus.COMPLETED,
        runId: 'run-completed',
        currentNodeId: null,
      }),
      [JourneyRunStatus.FAILED]: TestFixtures.createMockJourneyRun({
        status: JourneyRunStatus.FAILED,
        runId: 'run-failed',
      }),
      [JourneyRunStatus.WAITING_DELAY]: TestFixtures.createMockJourneyRun({
        status: JourneyRunStatus.WAITING_DELAY,
        runId: 'run-waiting',
        resumeAt: new Date(Date.now() + 3600000),
      }),
    };
  }
}
