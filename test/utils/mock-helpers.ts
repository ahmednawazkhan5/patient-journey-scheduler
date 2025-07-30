import { JourneyService } from '../../src/services/journey.service';
import { JourneyExecutionService } from '../../src/services/journey-execution.service';
import { NodeProcessorService } from '../../src/services/node-processor.service';
import { DatabaseService } from '../../src/database/database.service';
import { JourneyRunStatus } from '../../src/enums/journey-run-status.enum';
import { TestFixtures } from './test-fixtures';

/**
 * Mock helpers for creating consistent service mocks across tests
 */
export class MockHelpers {
  /**
   * Create a properly typed mock for JourneyService
   */
  static createMockJourneyService(): Partial<JourneyService> {
    return {
      createJourney: jest.fn(),
      getJourney: jest.fn(),
      getJourneyRun: jest.fn(),
      findNodeInJourney: jest.fn(),
      completeJourney: jest.fn(),
      failJourney: jest.fn(),
      updateJourneyRunStatus: jest.fn(),
    };
  }

  /**
   * Create a properly typed mock for JourneyExecutionService
   */
  static createMockJourneyExecutionService(): Partial<JourneyExecutionService> {
    return {
      triggerJourney: jest.fn(),
      resumeJourney: jest.fn(),
    };
  }

  /**
   * Create a properly typed mock for NodeProcessorService
   */
  static createMockNodeProcessorService(): Partial<NodeProcessorService> {
    return {
      processNode: jest.fn(),
      handleDelayNode: jest.fn(),
    };
  }

  /**
   * Create a properly typed mock for DatabaseService
   */
  static createMockDatabaseService(): Partial<DatabaseService> {
    return {
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    };
  }

  /**
   * Helper to safely cast and configure a mock method
   */
  static mockMethod<T extends (...args: any[]) => any>(
    mockObject: Record<string, any>,
    methodName: string,
  ): jest.Mock<ReturnType<T>, Parameters<T>> {
    return mockObject[methodName] as jest.Mock<ReturnType<T>, Parameters<T>>;
  }

  /**
   * Helper to configure common successful responses for JourneyService
   */
  static configureSuccessfulJourneyService(
    mockService: Partial<JourneyService>,
  ): void {
    const createJourney = this.mockMethod(mockService, 'createJourney');
    const getJourney = this.mockMethod(mockService, 'getJourney');
    const getJourneyRun = this.mockMethod(mockService, 'getJourneyRun');

    createJourney.mockResolvedValue('test-journey-id');
    getJourney.mockResolvedValue({
      id: 'test-journey-id',
      name: 'Test Journey',
      start_node_id: 'start',
      nodes: [],
    });
    getJourneyRun.mockResolvedValue({
      runId: 'test-run-id',
      journeyId: 'test-journey-id',
      status: JourneyRunStatus.IN_PROGRESS,
      currentNodeId: 'start',
      patientContext: TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT,
      resumeAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Helper to configure common successful responses for JourneyExecutionService
   */
  static configureSuccessfulJourneyExecutionService(
    mockService: Partial<JourneyExecutionService>,
  ): void {
    const triggerJourney = this.mockMethod(mockService, 'triggerJourney');
    const resumeJourney = this.mockMethod(mockService, 'resumeJourney');

    triggerJourney.mockResolvedValue('test-run-id');
    resumeJourney.mockResolvedValue(undefined);
  }

  /**
   * Helper to configure common successful responses for DatabaseService
   */
  static configureSuccessfulDatabaseService(
    mockService: Partial<DatabaseService>,
  ): void {
    const save = this.mockMethod(mockService, 'save');
    const findOne = this.mockMethod(mockService, 'findOne');
    const find = this.mockMethod(mockService, 'find');

    save.mockResolvedValue(undefined);
    findOne.mockResolvedValue(null);
    find.mockResolvedValue([]);
  }

  /**
   * Reset all mocks in a service object
   */
  static resetServiceMocks(mockService: Record<string, any>): void {
    Object.values(mockService).forEach((mock) => {
      if (jest.isMockFunction(mock)) {
        mock.mockReset();
      }
    });
  }

  /**
   * Clear all mock calls but keep implementations
   */
  static clearServiceMocks(mockService: Record<string, any>): void {
    Object.values(mockService).forEach((mock) => {
      if (jest.isMockFunction(mock)) {
        mock.mockClear();
      }
    });
  }
}
