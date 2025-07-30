import { Test, TestingModule } from '@nestjs/testing';
import { JourneyService } from '../../src/services/journey.service';
import { JourneyExecutionService } from '../../src/services/journey-execution.service';
import { DatabaseService } from '../../src/database/database.service';
import { MockHelpers } from './mock-helpers';

/**
 * Test setup helpers for consistent module creation
 */
export class TestSetup {
  /**
   * Create a testing module with mocked services for controller tests
   */
  static async createControllerTestModule(
    controllerClass: any,
    serviceProviders: Array<{ provide: any; useValue: any }>,
  ): Promise<TestingModule> {
    return Test.createTestingModule({
      controllers: [controllerClass],
      providers: serviceProviders,
    }).compile();
  }

  /**
   * Create a testing module with mocked dependencies for service tests
   */
  static async createServiceTestModule(
    serviceClass: any,
    dependencies: Array<{ provide: any; useValue: any }>,
  ): Promise<TestingModule> {
    return Test.createTestingModule({
      providers: [serviceClass, ...dependencies],
    }).compile();
  }

  /**
   * Helper to create common service mocks for most tests
   */
  static createCommonServiceMocks() {
    return {
      journeyService: MockHelpers.createMockJourneyService(),
      journeyExecutionService: MockHelpers.createMockJourneyExecutionService(),
      nodeProcessorService: MockHelpers.createMockNodeProcessorService(),
      databaseService: MockHelpers.createMockDatabaseService(),
    };
  }

  /**
   * Configure all service mocks with successful defaults
   */
  static configureSuccessfulMocks(mocks: {
    journeyService?: Partial<JourneyService>;
    journeyExecutionService?: Partial<JourneyExecutionService>;
    databaseService?: Partial<DatabaseService>;
  }) {
    if (mocks.journeyService) {
      MockHelpers.configureSuccessfulJourneyService(mocks.journeyService);
    }
    if (mocks.journeyExecutionService) {
      MockHelpers.configureSuccessfulJourneyExecutionService(
        mocks.journeyExecutionService,
      );
    }
    if (mocks.databaseService) {
      MockHelpers.configureSuccessfulDatabaseService(mocks.databaseService);
    }
  }

  /**
   * Clear all mocks between tests
   */
  static clearAllMocks(mocks: Record<string, Record<string, any>>) {
    Object.values(mocks).forEach((mockService) => {
      if (mockService && typeof mockService === 'object') {
        MockHelpers.clearServiceMocks(mockService);
      }
    });
  }

  /**
   * Reset all mocks between test suites
   */
  static resetAllMocks(mocks: Record<string, Record<string, any>>) {
    Object.values(mocks).forEach((mockService) => {
      if (mockService && typeof mockService === 'object') {
        MockHelpers.resetServiceMocks(mockService);
      }
    });
  }
}
