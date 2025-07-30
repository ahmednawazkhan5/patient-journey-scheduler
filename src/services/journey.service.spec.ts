/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { Logger, NotFoundException } from '@nestjs/common';
import { JourneyService } from './journey.service';
import { DatabaseService } from '../database/database.service';
import { Journey } from '../entities/journey.entity';
import { JourneyRun } from '../entities/journey-run.entity';
import { JourneyRunStatus } from '../enums/journey-run-status.enum';
import { TestFixtures, MockHelpers } from '../../test/utils';

// Mock external dependencies
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-journey-uuid-123'),
}));

describe('JourneyService', () => {
  let service: JourneyService;
  let databaseService: jest.Mocked<DatabaseService>;
  let loggerSpy: jest.SpyInstance;

  // Mock configuration helpers
  const setupSuccessfulDatabaseMocks = () => {
    MockHelpers.mockMethod(databaseService, 'save').mockResolvedValue(
      undefined,
    );
    MockHelpers.mockMethod(databaseService, 'findOne').mockResolvedValue(null);
  };

  const setupDatabaseErrorMocks = (
    errorType = 'Database connection failed',
  ) => {
    const error = new Error(errorType);
    MockHelpers.mockMethod(databaseService, 'save').mockRejectedValue(error);
    MockHelpers.mockMethod(databaseService, 'findOne').mockRejectedValue(error);
    return error;
  };

  const setupJourneyNotFoundMocks = () => {
    MockHelpers.mockMethod(databaseService, 'findOne').mockResolvedValue(null);
  };

  const setupJourneyFoundMocks = (journey: Journey) => {
    MockHelpers.mockMethod(databaseService, 'findOne').mockResolvedValue(
      journey,
    );
  };

  beforeEach(async () => {
    // Create service mocks
    const mockDatabaseService = MockHelpers.createMockDatabaseService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JourneyService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<JourneyService>(JourneyService);
    databaseService = module.get(DatabaseService);

    // Mock logger to prevent console output during tests
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    loggerSpy.mockRestore();

    // Reset UUID mock to default behavior
    const mockUuid = jest.requireMock('uuid');
    mockUuid.v4.mockReturnValue('mock-journey-uuid-123');
  });

  describe('createJourney', () => {
    describe('Happy Path', () => {
      it('should create journey with linear template', async () => {
        // Arrange
        const journeyTemplate = TestFixtures.JOURNEYS.LINEAR_JOURNEY;
        setupSuccessfulDatabaseMocks();

        // Act
        const result = await service.createJourney(journeyTemplate);

        // Assert
        expect(result).toBe('mock-journey-uuid-123');
        expect(databaseService.save).toHaveBeenCalledWith(
          Journey,
          expect.objectContaining({
            id: 'mock-journey-uuid-123',
            name: journeyTemplate.name,
            start_node_id: journeyTemplate.start_node_id,
            nodes: journeyTemplate.nodes,
          }),
        );
        expect(Logger.prototype.log).toHaveBeenCalledWith(
          'Created journey with ID: mock-journey-uuid-123',
        );
      });

      it('should create journey with conditional template', async () => {
        // Arrange
        const conditionalTemplate = TestFixtures.JOURNEYS.CONDITIONAL_JOURNEY;
        setupSuccessfulDatabaseMocks();

        // Act
        const result = await service.createJourney(conditionalTemplate);

        // Assert
        expect(result).toBe('mock-journey-uuid-123');
        expect(databaseService.save).toHaveBeenCalledWith(
          Journey,
          expect.objectContaining({
            name: conditionalTemplate.name,
            start_node_id: conditionalTemplate.start_node_id,
            nodes: expect.arrayContaining([
              expect.objectContaining({
                type: 'CONDITIONAL',
                condition: expect.any(Object),
              }),
            ]),
          }),
        );
      });

      it('should create journey with delay template', async () => {
        // Arrange
        const delayTemplate = TestFixtures.JOURNEYS.DELAY_JOURNEY;
        setupSuccessfulDatabaseMocks();

        // Act
        const result = await service.createJourney(delayTemplate);

        // Assert
        expect(result).toBe('mock-journey-uuid-123');
        expect(databaseService.save).toHaveBeenCalledWith(
          Journey,
          expect.objectContaining({
            name: delayTemplate.name,
            nodes: expect.arrayContaining([
              expect.objectContaining({
                type: 'DELAY',
                duration_seconds: expect.any(Number),
              }),
            ]),
          }),
        );
      });

      it('should create journey with complex template', async () => {
        // Arrange
        const complexTemplate = TestFixtures.JOURNEYS.COMPLEX_JOURNEY;
        setupSuccessfulDatabaseMocks();

        // Act
        const result = await service.createJourney(complexTemplate);

        // Assert
        expect(result).toBe('mock-journey-uuid-123');
        expect(databaseService.save).toHaveBeenCalledWith(
          Journey,
          expect.objectContaining({
            name: complexTemplate.name,
            nodes: expect.arrayContaining([
              expect.objectContaining({ type: 'MESSAGE' }),
              expect.objectContaining({ type: 'CONDITIONAL' }),
              expect.objectContaining({ type: 'DELAY' }),
            ]),
          }),
        );
      });
    });

    describe('Error Handling', () => {
      it('should handle database save failure', async () => {
        // Arrange
        const journeyTemplate = TestFixtures.JOURNEYS.LINEAR_JOURNEY;
        setupDatabaseErrorMocks('Save operation failed');

        // Act & Assert
        await expect(service.createJourney(journeyTemplate)).rejects.toThrow(
          'Save operation failed',
        );

        expect(databaseService.save).toHaveBeenCalledWith(
          Journey,
          expect.any(Object),
        );
        expect(Logger.prototype.log).not.toHaveBeenCalled();
      });

      it('should handle UUID generation failure', async () => {
        // Arrange
        const journeyTemplate = TestFixtures.JOURNEYS.LINEAR_JOURNEY;
        setupSuccessfulDatabaseMocks();

        // Mock UUID to throw error
        const mockUuid = jest.requireMock('uuid');
        mockUuid.v4.mockImplementation(() => {
          throw new Error('UUID generation failed');
        });

        // Act & Assert
        await expect(service.createJourney(journeyTemplate)).rejects.toThrow(
          'UUID generation failed',
        );

        expect(databaseService.save).not.toHaveBeenCalled();
      });

      it('should handle invalid journey data gracefully', async () => {
        // Arrange
        const invalidTemplate = {
          name: '',
          start_node_id: '',
          nodes: [],
        };
        setupSuccessfulDatabaseMocks();

        // Act
        const result = await service.createJourney(invalidTemplate);

        // Assert - Service should still create entity, validation happens elsewhere
        expect(result).toBe('mock-journey-uuid-123');
        expect(databaseService.save).toHaveBeenCalledWith(
          Journey,
          expect.objectContaining({
            name: '',
            start_node_id: '',
            nodes: [],
          }),
        );
      });
    });
  });

  describe('getJourney', () => {
    describe('Happy Path', () => {
      it('should retrieve existing linear journey', async () => {
        // Arrange
        const journeyEntity = TestFixtures.JOURNEY_ENTITIES.LINEAR();
        setupJourneyFoundMocks(journeyEntity);

        // Act
        const result = await service.getJourney('linear-journey-123');

        // Assert
        expect(result).toEqual(journeyEntity);
        expect(databaseService.findOne).toHaveBeenCalledWith(Journey, {
          where: { id: 'linear-journey-123' },
        });
      });

      it('should retrieve existing conditional journey', async () => {
        // Arrange
        const conditionalJourney = TestFixtures.JOURNEY_ENTITIES.CONDITIONAL();
        setupJourneyFoundMocks(conditionalJourney);

        // Act
        const result = await service.getJourney('conditional-journey-123');

        // Assert
        expect(result).toEqual(conditionalJourney);
        expect(result.nodes).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: 'CONDITIONAL' }),
          ]),
        );
      });

      it('should retrieve existing delay journey', async () => {
        // Arrange
        const delayJourney = TestFixtures.JOURNEY_ENTITIES.DELAY();
        setupJourneyFoundMocks(delayJourney);

        // Act
        const result = await service.getJourney('delay-journey-123');

        // Assert
        expect(result).toEqual(delayJourney);
        expect(result.nodes).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'DELAY',
              duration_seconds: expect.any(Number),
            }),
          ]),
        );
      });

      it('should handle journey with complex node structure', async () => {
        // Arrange
        const complexJourney = TestFixtures.JOURNEY_ENTITIES.COMPLEX();
        setupJourneyFoundMocks(complexJourney);

        // Act
        const result = await service.getJourney('complex-journey-123');

        // Assert
        expect(result).toEqual(complexJourney);
        expect(result.nodes.length).toBeGreaterThan(3);
        expect(result.nodes).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: 'MESSAGE' }),
            expect.objectContaining({ type: 'CONDITIONAL' }),
            expect.objectContaining({ type: 'DELAY' }),
          ]),
        );
      });
    });

    describe('Error Handling', () => {
      it('should throw NotFoundException for missing journey', async () => {
        // Arrange
        setupJourneyNotFoundMocks();

        // Act & Assert
        await expect(
          service.getJourney('non-existent-journey'),
        ).rejects.toThrow(NotFoundException);
        await expect(
          service.getJourney('non-existent-journey'),
        ).rejects.toThrow('Journey with ID non-existent-journey not found');

        expect(databaseService.findOne).toHaveBeenCalledWith(Journey, {
          where: { id: 'non-existent-journey' },
        });
      });

      it('should handle database query errors', async () => {
        // Arrange
        setupDatabaseErrorMocks('Connection timeout');

        // Act & Assert
        await expect(service.getJourney('some-journey')).rejects.toThrow(
          'Connection timeout',
        );

        expect(databaseService.findOne).toHaveBeenCalledWith(Journey, {
          where: { id: 'some-journey' },
        });
      });

      it('should handle empty journey ID', async () => {
        // Arrange
        setupJourneyNotFoundMocks();

        // Act & Assert
        await expect(service.getJourney('')).rejects.toThrow(NotFoundException);
        await expect(service.getJourney('')).rejects.toThrow(
          'Journey with ID  not found',
        );
      });
    });
  });

  describe('getJourneyRun', () => {
    describe('Happy Path', () => {
      it('should retrieve existing journey run with IN_PROGRESS status', async () => {
        // Arrange
        const journeyRun = TestFixtures.createMockJourneyRun({
          runId: 'test-run-123',
          status: JourneyRunStatus.IN_PROGRESS,
          currentNodeId: 'welcome',
        });
        MockHelpers.mockMethod(databaseService, 'findOne').mockResolvedValue(
          journeyRun,
        );

        // Act
        const result = await service.getJourneyRun('test-run-123');

        // Assert
        expect(result).toEqual(journeyRun);
        expect(result.status).toBe(JourneyRunStatus.IN_PROGRESS);
        expect(result.currentNodeId).toBe('welcome');
        expect(databaseService.findOne).toHaveBeenCalledWith(JourneyRun, {
          where: { runId: 'test-run-123' },
        });
      });

      it('should retrieve journey run with COMPLETED status', async () => {
        // Arrange
        const completedRun = TestFixtures.createMockJourneyRun({
          runId: 'completed-run-456',
          status: JourneyRunStatus.COMPLETED,
          currentNodeId: null,
        });
        MockHelpers.mockMethod(databaseService, 'findOne').mockResolvedValue(
          completedRun,
        );

        // Act
        const result = await service.getJourneyRun('completed-run-456');

        // Assert
        expect(result).toEqual(completedRun);
        expect(result.status).toBe(JourneyRunStatus.COMPLETED);
        expect(result.currentNodeId).toBeNull();
      });

      it('should retrieve journey run with WAITING_DELAY status', async () => {
        // Arrange
        const delayRun = TestFixtures.createMockJourneyRun({
          runId: 'delay-run-789',
          status: JourneyRunStatus.WAITING_DELAY,
          currentNodeId: 'wait-node',
          resumeAt: new Date('2025-07-31T12:00:00Z'),
        });
        MockHelpers.mockMethod(databaseService, 'findOne').mockResolvedValue(
          delayRun,
        );

        // Act
        const result = await service.getJourneyRun('delay-run-789');

        // Assert
        expect(result).toEqual(delayRun);
        expect(result.status).toBe(JourneyRunStatus.WAITING_DELAY);
        expect(result.resumeAt).toEqual(new Date('2025-07-31T12:00:00Z'));
      });

      it('should retrieve journey run with patient context', async () => {
        // Arrange
        const runWithContext = TestFixtures.createMockJourneyRun({
          runId: 'context-run-999',
          patientContext: TestFixtures.PATIENT_CONTEXTS.ELDERLY_PATIENT,
        });
        MockHelpers.mockMethod(databaseService, 'findOne').mockResolvedValue(
          runWithContext,
        );

        // Act
        const result = await service.getJourneyRun('context-run-999');

        // Assert
        expect(result).toEqual(runWithContext);
        expect(result.patientContext).toEqual(
          TestFixtures.PATIENT_CONTEXTS.ELDERLY_PATIENT,
        );
        expect(result.patientContext.age).toBe(85);
        expect(result.patientContext.condition).toBe('hip_replacement');
      });
    });

    describe('Error Handling', () => {
      it('should throw NotFoundException for missing journey run', async () => {
        // Arrange
        MockHelpers.mockMethod(databaseService, 'findOne').mockResolvedValue(
          null,
        );

        // Act & Assert
        await expect(service.getJourneyRun('non-existent-run')).rejects.toThrow(
          NotFoundException,
        );
        await expect(service.getJourneyRun('non-existent-run')).rejects.toThrow(
          'Journey run with ID non-existent-run not found',
        );

        expect(databaseService.findOne).toHaveBeenCalledWith(JourneyRun, {
          where: { runId: 'non-existent-run' },
        });
      });

      it('should handle database query errors', async () => {
        // Arrange
        setupDatabaseErrorMocks('Query execution failed');

        // Act & Assert
        await expect(service.getJourneyRun('some-run')).rejects.toThrow(
          'Query execution failed',
        );

        expect(databaseService.findOne).toHaveBeenCalledWith(JourneyRun, {
          where: { runId: 'some-run' },
        });
      });

      it('should handle empty run ID', async () => {
        // Arrange
        MockHelpers.mockMethod(databaseService, 'findOne').mockResolvedValue(
          null,
        );

        // Act & Assert
        await expect(service.getJourneyRun('')).rejects.toThrow(
          NotFoundException,
        );
        await expect(service.getJourneyRun('')).rejects.toThrow(
          'Journey run with ID  not found',
        );
      });
    });
  });

  describe('findNodeInJourney', () => {
    describe('Happy Path', () => {
      it('should find existing node in linear journey', () => {
        // Arrange
        const journey = TestFixtures.JOURNEY_ENTITIES.LINEAR();
        const expectedNode = journey.nodes[0]; // 'welcome' node

        // Act
        const result = service.findNodeInJourney(journey, 'welcome');

        // Assert
        expect(result).toEqual(expectedNode);
        expect(result?.id).toBe('welcome');
        expect(result?.type).toBe('MESSAGE');
      });

      it('should find conditional node with complex structure', () => {
        // Arrange
        const conditionalJourney = TestFixtures.JOURNEY_ENTITIES.CONDITIONAL();
        const conditionalNodeId = 'age-check';

        // Act
        const result = service.findNodeInJourney(
          conditionalJourney,
          conditionalNodeId,
        );

        // Assert
        expect(result).toBeDefined();
        expect(result?.id).toBe(conditionalNodeId);
        expect(result?.type).toBe('CONDITIONAL');
        expect((result as any)?.condition).toBeDefined();
      });

      it('should find delay node with duration', () => {
        // Arrange
        const delayJourney = TestFixtures.JOURNEY_ENTITIES.DELAY();
        const delayNodeId = 'wait-1hour';

        // Act
        const result = service.findNodeInJourney(delayJourney, delayNodeId);

        // Assert
        expect(result).toBeDefined();
        expect(result?.id).toBe(delayNodeId);
        expect(result?.type).toBe('DELAY');
        expect((result as any)?.duration_seconds).toBe(3600);
      });

      it('should find node in complex multi-path journey', () => {
        // Arrange
        const complexJourney = TestFixtures.JOURNEY_ENTITIES.COMPLEX();
        const spanishNodeId = 'spanish-path';

        // Act
        const result = service.findNodeInJourney(complexJourney, spanishNodeId);

        // Assert
        expect(result).toBeDefined();
        expect(result?.id).toBe(spanishNodeId);
        expect(result?.type).toBe('MESSAGE');
      });
    });

    describe('Edge Cases', () => {
      it('should return null for non-existent node', () => {
        // Arrange
        const journey = TestFixtures.JOURNEY_ENTITIES.LINEAR();

        // Act
        const result = service.findNodeInJourney(journey, 'non-existent-node');

        // Assert
        expect(result).toBeNull();
      });

      it('should handle empty nodes array', () => {
        // Arrange
        const emptyJourney = TestFixtures.createMockJourneyEntity(
          {
            name: 'Empty Journey',
            start_node_id: 'start',
            nodes: [],
          },
          'empty-journey',
        );

        // Act
        const result = service.findNodeInJourney(emptyJourney, 'any-node');

        // Assert
        expect(result).toBeNull();
      });

      it('should handle journey with null nodes gracefully', () => {
        // Arrange
        const journeyWithNullNodes = TestFixtures.createMockJourneyEntity(
          {
            name: 'Null Nodes Journey',
            start_node_id: 'start',
            nodes: null as any,
          },
          'null-nodes-journey',
        );

        // Act & Assert
        expect(() =>
          service.findNodeInJourney(journeyWithNullNodes, 'any-node'),
        ).toThrow();
      });

      it('should handle empty string node ID', () => {
        // Arrange
        const journey = TestFixtures.JOURNEY_ENTITIES.LINEAR();

        // Act
        const result = service.findNodeInJourney(journey, '');

        // Assert
        expect(result).toBeNull();
      });

      it('should be case sensitive for node IDs', () => {
        // Arrange
        const journey = TestFixtures.JOURNEY_ENTITIES.LINEAR();

        // Act
        const result = service.findNodeInJourney(journey, 'WELCOME'); // uppercase

        // Assert
        expect(result).toBeNull(); // Should not find 'welcome' with 'WELCOME'
      });
    });
  });
});
