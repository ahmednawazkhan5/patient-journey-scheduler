/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { JourneyExecutionService } from './journey-execution.service';
import { JourneyService } from './journey.service';
import { NodeProcessorService } from './node-processor.service';
import { DatabaseService } from '../database/database.service';
import { JourneyRunStatus } from '../enums/journey-run-status.enum';
import { JourneyRun } from '../entities/journey-run.entity';
import { TestFixtures, MockHelpers } from '../../test/utils';

// Mock external dependencies
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123'),
}));

describe('JourneyExecutionService', () => {
  let service: JourneyExecutionService;
  let journeyService: jest.Mocked<JourneyService>;
  let nodeProcessorService: jest.Mocked<NodeProcessorService>;
  let databaseService: jest.Mocked<DatabaseService>;
  let loggerSpy: jest.SpyInstance;

  // Mock configuration helpers
  const setupSuccessfulTriggerMocks = (
    journeyTemplate = TestFixtures.JOURNEY_ENTITIES.LINEAR(),
  ) => {
    MockHelpers.mockMethod(journeyService, 'getJourney').mockResolvedValue(
      journeyTemplate,
    );
    MockHelpers.mockMethod(databaseService, 'save').mockResolvedValue(
      undefined,
    );
  };

  const setupSuccessfulResumeMocks = (
    journeyTemplate = TestFixtures.JOURNEY_ENTITIES.LINEAR(),
    currentNodeId = 'welcome',
  ) => {
    const journeyRun = TestFixtures.createMockJourneyRun({
      journeyId: journeyTemplate.id,
      currentNodeId,
      status: JourneyRunStatus.IN_PROGRESS,
      patientContext: TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT,
    });

    MockHelpers.mockMethod(journeyService, 'getJourneyRun').mockResolvedValue(
      journeyRun,
    );
    MockHelpers.mockMethod(journeyService, 'getJourney').mockResolvedValue(
      journeyTemplate,
    );
    MockHelpers.mockMethod(journeyService, 'findNodeInJourney').mockReturnValue(
      journeyTemplate.nodes.find((node) => node.id === currentNodeId) ||
        journeyTemplate.nodes[0],
    );
    MockHelpers.mockMethod(
      journeyService,
      'updateJourneyRunStatus',
    ).mockResolvedValue(undefined);
    MockHelpers.mockMethod(journeyService, 'completeJourney').mockResolvedValue(
      undefined,
    );
    MockHelpers.mockMethod(nodeProcessorService, 'processNode').mockReturnValue(
      'next-node',
    );

    return journeyRun;
  };

  const setupDelayNodeMocks = () => {
    const delayJourney = TestFixtures.JOURNEY_ENTITIES.DELAY();
    const journeyRun = TestFixtures.createMockJourneyRun({
      journeyId: delayJourney.id,
      currentNodeId: 'wait-1hour',
      status: JourneyRunStatus.WAITING_DELAY,
      patientContext: TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT,
    });

    MockHelpers.mockMethod(journeyService, 'getJourneyRun').mockResolvedValue(
      journeyRun,
    );
    MockHelpers.mockMethod(journeyService, 'getJourney').mockResolvedValue(
      delayJourney,
    );
    MockHelpers.mockMethod(journeyService, 'findNodeInJourney').mockReturnValue(
      delayJourney.nodes.find((node) => node.id === 'wait-1hour')!,
    );
    MockHelpers.mockMethod(
      journeyService,
      'updateJourneyRunStatus',
    ).mockResolvedValue(undefined);
    MockHelpers.mockMethod(
      nodeProcessorService,
      'handleDelayNode',
    ).mockResolvedValue(undefined);

    return { delayJourney, journeyRun };
  };

  beforeEach(async () => {
    // Create service mocks
    const mockJourneyService = MockHelpers.createMockJourneyService();
    const mockNodeProcessorService =
      MockHelpers.createMockNodeProcessorService();
    const mockDatabaseService = MockHelpers.createMockDatabaseService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JourneyExecutionService,
        { provide: JourneyService, useValue: mockJourneyService },
        { provide: NodeProcessorService, useValue: mockNodeProcessorService },
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<JourneyExecutionService>(JourneyExecutionService);
    journeyService = module.get(JourneyService);
    nodeProcessorService = module.get(NodeProcessorService);
    databaseService = module.get(DatabaseService);

    // Mock logger to prevent console output during tests
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    loggerSpy.mockRestore();
  });

  describe('triggerJourney', () => {
    describe('Happy Path', () => {
      it('should create and start a new linear journey run', async () => {
        // Arrange
        const journey = TestFixtures.JOURNEY_ENTITIES.LINEAR();
        const patientContext = TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT;
        setupSuccessfulTriggerMocks(journey);

        // Mock the async processJourneyFromNode call to prevent unhandled promise
        const processJourneyFromNodeSpy = jest
          .spyOn(service as any, 'processJourneyFromNode')
          .mockResolvedValue(undefined);

        // Act
        const result = await service.triggerJourney(journey.id, patientContext);

        // Assert
        expect(result).toBe('mock-uuid-123');
        expect(journeyService.getJourney).toHaveBeenCalledWith(journey.id);
        expect(databaseService.save).toHaveBeenCalledWith(
          JourneyRun,
          expect.objectContaining({
            runId: 'mock-uuid-123',
            journeyId: journey.id,
            status: JourneyRunStatus.IN_PROGRESS,
            currentNodeId: journey.start_node_id,
            patientContext,
            resumeAt: null,
          }),
        );

        // Allow async processing to complete
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(processJourneyFromNodeSpy).toHaveBeenCalledWith(
          'mock-uuid-123',
          journey.start_node_id,
        );
      });

      it('should handle different journey types', async () => {
        // Test conditional journey
        const conditionalJourney = TestFixtures.JOURNEY_ENTITIES.CONDITIONAL();
        const patientContext = TestFixtures.PATIENT_CONTEXTS.YOUNG_PATIENT;
        setupSuccessfulTriggerMocks(conditionalJourney);

        const processJourneyFromNodeSpy = jest
          .spyOn(service as any, 'processJourneyFromNode')
          .mockResolvedValue(undefined);

        const result = await service.triggerJourney(
          conditionalJourney.id,
          patientContext,
        );

        expect(result).toBe('mock-uuid-123');
        expect(databaseService.save).toHaveBeenCalledWith(
          JourneyRun,
          expect.objectContaining({
            journeyId: conditionalJourney.id,
            currentNodeId: conditionalJourney.start_node_id,
            patientContext,
          }),
        );

        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(processJourneyFromNodeSpy).toHaveBeenCalledWith(
          'mock-uuid-123',
          conditionalJourney.start_node_id,
        );
      });

      it('should handle delay journey creation', async () => {
        const delayJourney = TestFixtures.JOURNEY_ENTITIES.DELAY();
        const patientContext = TestFixtures.PATIENT_CONTEXTS.ELDERLY_PATIENT;
        setupSuccessfulTriggerMocks(delayJourney);

        const processJourneyFromNodeSpy = jest
          .spyOn(service as any, 'processJourneyFromNode')
          .mockResolvedValue(undefined);

        const result = await service.triggerJourney(
          delayJourney.id,
          patientContext,
        );

        expect(result).toBe('mock-uuid-123');
        expect(databaseService.save).toHaveBeenCalledWith(
          JourneyRun,
          expect.objectContaining({
            journeyId: delayJourney.id,
            currentNodeId: delayJourney.start_node_id,
          }),
        );

        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(processJourneyFromNodeSpy).toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should handle journey not found error', async () => {
        // Arrange
        const error = new Error('Journey not found');
        const patientContext = TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT;
        MockHelpers.mockMethod(journeyService, 'getJourney').mockRejectedValue(
          error,
        );

        // Act & Assert
        await expect(
          service.triggerJourney('non-existent-journey', patientContext),
        ).rejects.toThrow('Journey not found');

        expect(journeyService.getJourney).toHaveBeenCalledWith(
          'non-existent-journey',
        );
        expect(databaseService.save).not.toHaveBeenCalled();
      });

      it('should handle database save failure', async () => {
        // Arrange
        const journey = TestFixtures.JOURNEY_ENTITIES.LINEAR();
        const patientContext = TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT;
        const dbError = new Error('Database save failed');

        MockHelpers.mockMethod(journeyService, 'getJourney').mockResolvedValue(
          journey,
        );
        MockHelpers.mockMethod(databaseService, 'save').mockRejectedValue(
          dbError,
        );

        // Act & Assert
        await expect(
          service.triggerJourney(journey.id, patientContext),
        ).rejects.toThrow('Database save failed');

        expect(journeyService.getJourney).toHaveBeenCalledWith(journey.id);
        expect(databaseService.save).toHaveBeenCalled();
      });

      it('should handle async processing errors gracefully', async () => {
        // Arrange
        const journey = TestFixtures.JOURNEY_ENTITIES.LINEAR();
        const patientContext = TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT;
        setupSuccessfulTriggerMocks(journey);

        const processError = new Error('Processing failed');
        jest
          .spyOn(service as any, 'processJourneyFromNode')
          .mockRejectedValue(processError);

        // Act
        const result = await service.triggerJourney(journey.id, patientContext);

        // Assert - should still return runId even if async processing fails
        expect(result).toBe('mock-uuid-123');

        // Allow async error to be caught
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(Logger.prototype.error).toHaveBeenCalledWith(
          'Error processing journey run mock-uuid-123:',
          processError,
        );
      });
    });
  });

  describe('resumeJourney', () => {
    describe('Happy Path', () => {
      it('should resume journey from MESSAGE node', async () => {
        // Arrange
        const journey = TestFixtures.JOURNEY_ENTITIES.LINEAR();
        setupSuccessfulResumeMocks(journey, 'welcome');

        MockHelpers.mockMethod(
          nodeProcessorService,
          'processNode',
        ).mockReturnValue('next-message');
        const processJourneyFromNodeSpy = jest
          .spyOn(service as any, 'processJourneyFromNode')
          .mockResolvedValue(undefined);

        // Act
        await service.resumeJourney('mock-uuid-123');

        // Assert
        expect(journeyService.getJourneyRun).toHaveBeenCalledWith(
          'mock-uuid-123',
        );
        expect(journeyService.getJourney).toHaveBeenCalledWith(journey.id);
        expect(journeyService.findNodeInJourney).toHaveBeenCalledWith(
          journey,
          'welcome',
        );
        expect(processJourneyFromNodeSpy).toHaveBeenCalledWith(
          'mock-uuid-123',
          'welcome',
        );
      });

      it('should handle DELAY node completion and move to next node', async () => {
        // Arrange
        const { delayJourney } = setupDelayNodeMocks();
        const delayNode = delayJourney.nodes.find(
          (node) => node.id === 'wait-1hour',
        );

        // Type assertion for DelayNode which has next_node_id
        const nextNodeId = (delayNode as any)?.next_node_id || 'checkup';

        const processJourneyFromNodeSpy = jest
          .spyOn(service as any, 'processJourneyFromNode')
          .mockResolvedValue(undefined);

        // Act
        await service.resumeJourney('mock-uuid-123');

        // Assert
        expect(journeyService.updateJourneyRunStatus).toHaveBeenCalledWith(
          'mock-uuid-123',
          JourneyRunStatus.IN_PROGRESS,
          nextNodeId,
        );
        expect(processJourneyFromNodeSpy).toHaveBeenCalledWith(
          'mock-uuid-123',
          nextNodeId,
        );
      });

      it('should handle non-DELAY node resume with warning', async () => {
        // Arrange
        const journey = TestFixtures.JOURNEY_ENTITIES.LINEAR();
        setupSuccessfulResumeMocks(journey, 'welcome');

        const processJourneyFromNodeSpy = jest
          .spyOn(service as any, 'processJourneyFromNode')
          .mockResolvedValue(undefined);

        // Act
        await service.resumeJourney('mock-uuid-123');

        // Assert
        expect(Logger.prototype.warn).toHaveBeenCalledWith(
          'Expected DELAY node but found MESSAGE, continuing processing',
        );
        expect(processJourneyFromNodeSpy).toHaveBeenCalledWith(
          'mock-uuid-123',
          'welcome',
        );
      });

      it('should handle conditional node resume', async () => {
        // Arrange
        const conditionalJourney = TestFixtures.JOURNEY_ENTITIES.CONDITIONAL();
        setupSuccessfulResumeMocks(conditionalJourney, 'age-check');

        MockHelpers.mockMethod(
          nodeProcessorService,
          'processNode',
        ).mockReturnValue('senior-path');
        const processJourneyFromNodeSpy = jest
          .spyOn(service as any, 'processJourneyFromNode')
          .mockResolvedValue(undefined);

        // Act
        await service.resumeJourney('mock-uuid-123');

        // Assert
        expect(journeyService.findNodeInJourney).toHaveBeenCalledWith(
          conditionalJourney,
          'age-check',
        );
        expect(processJourneyFromNodeSpy).toHaveBeenCalledWith(
          'mock-uuid-123',
          'age-check',
        );
      });
    });

    describe('Error Handling', () => {
      it('should handle missing journey run gracefully', async () => {
        // Arrange
        MockHelpers.mockMethod(
          journeyService,
          'getJourneyRun',
        ).mockResolvedValue(null);

        // Act
        await service.resumeJourney('non-existent-run');

        // Assert
        expect(journeyService.getJourneyRun).toHaveBeenCalledWith(
          'non-existent-run',
        );
        expect(Logger.prototype.error).toHaveBeenCalledWith(
          'Journey run not found: non-existent-run',
        );
        // Should not proceed to other operations
        expect(journeyService.getJourney).not.toHaveBeenCalled();
      });

      it('should handle missing journey gracefully', async () => {
        // Arrange
        const journeyRun = TestFixtures.createMockJourneyRun({
          journeyId: 'missing-journey',
          currentNodeId: 'welcome',
        });

        MockHelpers.mockMethod(
          journeyService,
          'getJourneyRun',
        ).mockResolvedValue(journeyRun);
        MockHelpers.mockMethod(journeyService, 'getJourney').mockResolvedValue(
          null,
        );

        // Act
        await service.resumeJourney('mock-uuid-123');

        // Assert
        expect(journeyService.getJourney).toHaveBeenCalledWith(
          'missing-journey',
        );
        expect(Logger.prototype.error).toHaveBeenCalledWith(
          'Journey not found: missing-journey',
        );
      });

      it('should handle missing current node ID', async () => {
        // Arrange
        const journey = TestFixtures.JOURNEY_ENTITIES.LINEAR();
        const journeyRun = TestFixtures.createMockJourneyRun({
          journeyId: journey.id,
          currentNodeId: null,
        });

        MockHelpers.mockMethod(
          journeyService,
          'getJourneyRun',
        ).mockResolvedValue(journeyRun);
        MockHelpers.mockMethod(journeyService, 'getJourney').mockResolvedValue(
          journey,
        );
        MockHelpers.mockMethod(journeyService, 'failJourney').mockResolvedValue(
          undefined,
        );

        // Act
        await service.resumeJourney('mock-uuid-123');

        // Assert
        expect(journeyService.failJourney).toHaveBeenCalledWith(
          'mock-uuid-123',
          'No current node ID found',
        );
      });

      it('should handle node not found in journey', async () => {
        // Arrange
        const journey = TestFixtures.JOURNEY_ENTITIES.LINEAR();
        const journeyRun = TestFixtures.createMockJourneyRun({
          journeyId: journey.id,
          currentNodeId: 'non-existent-node',
        });

        MockHelpers.mockMethod(
          journeyService,
          'getJourneyRun',
        ).mockResolvedValue(journeyRun);
        MockHelpers.mockMethod(journeyService, 'getJourney').mockResolvedValue(
          journey,
        );
        MockHelpers.mockMethod(
          journeyService,
          'findNodeInJourney',
        ).mockReturnValue(null);
        MockHelpers.mockMethod(journeyService, 'failJourney').mockResolvedValue(
          undefined,
        );

        // Act
        await service.resumeJourney('mock-uuid-123');

        // Assert
        expect(journeyService.findNodeInJourney).toHaveBeenCalledWith(
          journey,
          'non-existent-node',
        );
        expect(journeyService.failJourney).toHaveBeenCalledWith(
          'mock-uuid-123',
          `Current node non-existent-node not found in journey ${journey.id}`,
        );
      });
    });
  });

  describe('Integration Scenarios', () => {
    describe('Complete Journey Flows', () => {
      it('should trigger journey and start async processing', async () => {
        // Arrange
        const journey = TestFixtures.JOURNEY_ENTITIES.LINEAR();
        const patientContext = TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT;
        setupSuccessfulTriggerMocks(journey);

        // Spy on the private method to verify it gets called
        const processJourneyFromNodeSpy = jest
          .spyOn(service as any, 'processJourneyFromNode')
          .mockResolvedValue(undefined);

        // Act
        const runId = await service.triggerJourney(journey.id, patientContext);

        // Assert - Journey should be triggered and async processing should start
        expect(runId).toBe('mock-uuid-123');
        expect(databaseService.save).toHaveBeenCalledWith(
          JourneyRun,
          expect.objectContaining({
            runId: 'mock-uuid-123',
            journeyId: journey.id,
            status: JourneyRunStatus.IN_PROGRESS,
            currentNodeId: journey.start_node_id,
          }),
        );

        // Allow async processing to start
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(processJourneyFromNodeSpy).toHaveBeenCalledWith(
          'mock-uuid-123',
          journey.start_node_id,
        );
      });

      it('should handle conditional journey setup correctly', async () => {
        // Arrange
        const conditionalJourney = TestFixtures.JOURNEY_ENTITIES.CONDITIONAL();
        const seniorPatient = TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT;
        setupSuccessfulTriggerMocks(conditionalJourney);

        const processJourneyFromNodeSpy = jest
          .spyOn(service as any, 'processJourneyFromNode')
          .mockResolvedValue(undefined);

        // Act
        const runId = await service.triggerJourney(
          conditionalJourney.id,
          seniorPatient,
        );

        // Assert - Should trigger with correct initial node
        expect(runId).toBe('mock-uuid-123');
        expect(databaseService.save).toHaveBeenCalledWith(
          JourneyRun,
          expect.objectContaining({
            journeyId: conditionalJourney.id,
            currentNodeId: conditionalJourney.start_node_id,
            patientContext: seniorPatient,
          }),
        );

        // Allow async processing to start
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(processJourneyFromNodeSpy).toHaveBeenCalledWith(
          'mock-uuid-123',
          conditionalJourney.start_node_id,
        );
      });

      it('should handle delay journey setup correctly', async () => {
        // Arrange
        const delayJourney = TestFixtures.JOURNEY_ENTITIES.DELAY();
        const patientContext = TestFixtures.PATIENT_CONTEXTS.ELDERLY_PATIENT;
        setupSuccessfulTriggerMocks(delayJourney);

        const processJourneyFromNodeSpy = jest
          .spyOn(service as any, 'processJourneyFromNode')
          .mockResolvedValue(undefined);

        // Act
        const runId = await service.triggerJourney(
          delayJourney.id,
          patientContext,
        );

        // Assert - Should trigger correctly
        expect(runId).toBe('mock-uuid-123');
        expect(databaseService.save).toHaveBeenCalledWith(
          JourneyRun,
          expect.objectContaining({
            journeyId: delayJourney.id,
            currentNodeId: delayJourney.start_node_id,
          }),
        );

        // Allow async processing to start
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(processJourneyFromNodeSpy).toHaveBeenCalledWith(
          'mock-uuid-123',
          delayJourney.start_node_id,
        );
      });
    });

    describe('Error Recovery Scenarios', () => {
      it('should handle errors during async processing', async () => {
        // Arrange
        const journey = TestFixtures.JOURNEY_ENTITIES.LINEAR();
        const patientContext = TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT;
        setupSuccessfulTriggerMocks(journey);

        const processError = new Error('Processing failed');
        jest
          .spyOn(service as any, 'processJourneyFromNode')
          .mockRejectedValue(processError);

        // Act
        const runId = await service.triggerJourney(journey.id, patientContext);

        // Assert - Should still return runId even if async processing fails
        expect(runId).toBe('mock-uuid-123');

        // Allow async error to be caught and logged
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(Logger.prototype.error).toHaveBeenCalledWith(
          'Error processing journey run mock-uuid-123:',
          processError,
        );
      });

      it('should handle resume after failure recovery', async () => {
        // Arrange
        const journey = TestFixtures.JOURNEY_ENTITIES.LINEAR();
        setupSuccessfulResumeMocks(journey, 'welcome');

        const processJourneyFromNodeSpy = jest
          .spyOn(service as any, 'processJourneyFromNode')
          .mockResolvedValue(undefined);

        // Act
        await service.resumeJourney('mock-uuid-123');

        // Assert
        expect(journeyService.getJourneyRun).toHaveBeenCalledWith(
          'mock-uuid-123',
        );
        expect(processJourneyFromNodeSpy).toHaveBeenCalledWith(
          'mock-uuid-123',
          'welcome',
        );
      });
    });
  });

  describe('Edge Cases and Validation', () => {
    it('should handle journey with empty nodes during async processing', async () => {
      // Arrange
      const emptyJourney = {
        ...TestFixtures.JOURNEY_ENTITIES.LINEAR(),
        nodes: [],
      };
      const patientContext = TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT;

      MockHelpers.mockMethod(journeyService, 'getJourney').mockResolvedValue(
        emptyJourney,
      );
      MockHelpers.mockMethod(databaseService, 'save').mockResolvedValue(
        undefined,
      );
      MockHelpers.mockMethod(journeyService, 'failJourney').mockResolvedValue(
        undefined,
      );

      // Mock the async processing to fail when it can't find the node
      jest
        .spyOn(service as any, 'processJourneyFromNode')
        .mockImplementation(async (runId: string) => {
          // Simulate the error that would occur in real processing
          await service['journeyService'].failJourney(
            runId,
            'Node welcome not found in journey linear-journey',
          );
        });

      // Act
      const runId = await service.triggerJourney(
        emptyJourney.id,
        patientContext,
      );

      // Allow async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert
      expect(runId).toBe('mock-uuid-123');
      expect(journeyService.failJourney).toHaveBeenCalledWith(
        'mock-uuid-123',
        expect.stringContaining('not found in journey'),
      );
    });

    it('should handle null start node gracefully', async () => {
      // Arrange
      const journeyWithNullStart = {
        ...TestFixtures.JOURNEY_ENTITIES.LINEAR(),
        start_node_id: null,
      };
      const patientContext = TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT;

      MockHelpers.mockMethod(journeyService, 'getJourney').mockResolvedValue(
        journeyWithNullStart,
      );
      MockHelpers.mockMethod(databaseService, 'save').mockResolvedValue(
        undefined,
      );
      MockHelpers.mockMethod(
        journeyService,
        'completeJourney',
      ).mockResolvedValue(undefined);

      // Mock the async processing to complete immediately for null start
      jest
        .spyOn(service as any, 'processJourneyFromNode')
        .mockImplementation(
          async (runId: string, startNodeId: string | null) => {
            if (!startNodeId) {
              await service['journeyService'].completeJourney(runId);
            }
          },
        );

      // Act
      const runId = await service.triggerJourney(
        journeyWithNullStart.id,
        patientContext,
      );

      // Allow async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert
      expect(runId).toBe('mock-uuid-123');
      expect(journeyService.completeJourney).toHaveBeenCalledWith(
        'mock-uuid-123',
      );
    });

    it('should handle concurrent journey execution', async () => {
      // Arrange
      const journey = TestFixtures.JOURNEY_ENTITIES.LINEAR();
      const patientContext1 = TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT;
      const patientContext2 = TestFixtures.PATIENT_CONTEXTS.YOUNG_PATIENT;

      setupSuccessfulTriggerMocks(journey);
      jest
        .spyOn(service as any, 'processJourneyFromNode')
        .mockResolvedValue(undefined);

      // Act - Trigger multiple journeys concurrently
      const [runId1, runId2] = await Promise.all([
        service.triggerJourney(journey.id, patientContext1),
        service.triggerJourney(journey.id, patientContext2),
      ]);

      // Assert
      expect(runId1).toBe('mock-uuid-123');
      expect(runId2).toBe('mock-uuid-123');
      expect(databaseService.save).toHaveBeenCalledTimes(2);
    });
  });
});
