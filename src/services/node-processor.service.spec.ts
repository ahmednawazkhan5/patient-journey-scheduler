/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';

import { NodeProcessorService } from './node-processor.service';
import { DatabaseService } from '../database/database.service';
import { NodeType } from '../enums/node-type.enum';
import { JourneyRunStatus } from '../enums/journey-run-status.enum';
import { JourneyRun } from '../entities/journey-run.entity';
import { ActionNode } from '../interfaces/journey.interface';
import { TestFixtures } from '../../test/utils/test-fixtures';
import { MockHelpers } from '../../test/utils/mock-helpers';

describe('NodeProcessorService', () => {
  let service: NodeProcessorService;
  let databaseService: jest.Mocked<DatabaseService>;
  let loggerSpy: jest.SpyInstance;

  // Setup helpers
  const setupMocks = () => {
    MockHelpers.mockMethod(databaseService, 'save').mockResolvedValue(
      undefined,
    );
  };

  const setupDatabaseError = (errorMessage = 'Database error') => {
    MockHelpers.mockMethod(databaseService, 'save').mockRejectedValue(
      new Error(errorMessage),
    );
  };

  beforeEach(async () => {
    const mockDatabaseService = MockHelpers.createMockDatabaseService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodeProcessorService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    // Disable logging during tests
    module.useLogger(false);

    service = module.get<NodeProcessorService>(NodeProcessorService);
    databaseService = module.get(DatabaseService);

    // Mock logger to prevent console output
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    setupMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    loggerSpy.mockRestore();
  });

  describe('processNode() - Main Router', () => {
    it('should route MESSAGE node to correct processor', () => {
      // Arrange
      const messageNode = TestFixtures.TEST_NODES.MESSAGE.BASIC;

      // Act
      const result = service.processNode(
        messageNode,
        TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT,
      );

      // Assert
      expect(result).toBe('next-step');
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('MESSAGE node msg-basic'),
      );
    });

    it('should route DELAY node to correct processor', () => {
      // Arrange
      const delayNode = TestFixtures.TEST_NODES.DELAY.SHORT;

      // Act
      const result = service.processNode(
        delayNode,
        TestFixtures.PATIENT_CONTEXTS.YOUNG_PATIENT,
      );

      // Assert
      expect(result).toBe('after-delay');
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('DELAY node delay-short'),
      );
    });

    it('should route CONDITIONAL node to correct processor', () => {
      // Arrange
      const conditionalNode = TestFixtures.TEST_NODES.CONDITIONAL.AGE_SENIOR;

      // Act
      const result = service.processNode(
        conditionalNode,
        TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT,
      );

      // Assert
      expect(result).toBe('senior-path');
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('CONDITIONAL node cond-age-senior'),
      );
    });

    it('should return null for unknown node type', () => {
      // Arrange
      const unknownNode = {
        id: 'unknown-node',
        type: 'UNKNOWN_TYPE' as NodeType,
        next_node_id: 'next',
      } as unknown as ActionNode;

      // Act
      const result = service.processNode(
        unknownNode,
        TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT,
      );

      // Assert
      expect(result).toBeNull();
      expect(Logger.prototype.error).toHaveBeenCalledWith('Unknown node type');
    });
  });

  describe('MESSAGE Node Processing', () => {
    it('should process message node with next_node_id', () => {
      // Arrange
      const messageNode = TestFixtures.TEST_NODES.MESSAGE.BASIC;

      // Act
      const result = service.processNode(
        messageNode,
        TestFixtures.PATIENT_CONTEXTS.YOUNG_PATIENT,
      );

      // Assert
      expect(result).toBe('next-step');
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'MESSAGE node msg-basic: Sent message to patient patient-young-456',
      );
    });

    it('should handle message node with null next_node_id', () => {
      // Arrange
      const finalNode = TestFixtures.TEST_NODES.MESSAGE.FINAL;

      // Act
      const result = service.processNode(
        finalNode,
        TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT,
      );

      // Assert
      expect(result).toBeNull();
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'MESSAGE node msg-final: Sent message to patient patient-senior-123',
      );
    });
  });

  describe('DELAY Node Processing', () => {
    it('should process short delay node', () => {
      // Arrange
      const shortDelay = TestFixtures.TEST_NODES.DELAY.SHORT;

      // Act
      const result = service.processNode(
        shortDelay,
        TestFixtures.PATIENT_CONTEXTS.ELDERLY_PATIENT,
      );

      // Assert
      expect(result).toBe('after-delay');
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'DELAY node delay-short: Scheduling delay for 300 seconds',
      );
    });

    it('should process long delay node', () => {
      // Arrange
      const longDelay = TestFixtures.TEST_NODES.DELAY.LONG;

      // Act
      const result = service.processNode(
        longDelay,
        TestFixtures.PATIENT_CONTEXTS.YOUNG_PATIENT,
      );

      // Assert
      expect(result).toBe('next-day');
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'DELAY node delay-long: Scheduling delay for 86400 seconds',
      );
    });

    it('should handle delay node with null next_node_id', () => {
      // Arrange
      const finalDelay = TestFixtures.TEST_NODES.DELAY.FINAL;

      // Act
      const result = service.processNode(
        finalDelay,
        TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT,
      );

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('CONDITIONAL Node Processing', () => {
    it('should evaluate age condition correctly for senior patient', () => {
      // Arrange
      const ageCondition = TestFixtures.TEST_NODES.CONDITIONAL.AGE_SENIOR;

      // Act
      const result = service.processNode(
        ageCondition,
        TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT,
      );

      // Assert
      expect(result).toBe('senior-path');
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'CONDITIONAL node cond-age-senior: age >= 65 = true',
      );
    });

    it('should evaluate age condition correctly for young patient', () => {
      // Arrange
      const ageCondition = TestFixtures.TEST_NODES.CONDITIONAL.AGE_SENIOR;

      // Act
      const result = service.processNode(
        ageCondition,
        TestFixtures.PATIENT_CONTEXTS.YOUNG_PATIENT,
      );

      // Assert
      expect(result).toBe('standard-path');
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'CONDITIONAL node cond-age-senior: age >= 65 = false',
      );
    });

    it('should evaluate string equality condition', () => {
      // Arrange
      const languageCondition = TestFixtures.TEST_NODES.CONDITIONAL.LANGUAGE_EN;

      // Act
      const result = service.processNode(
        languageCondition,
        TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT,
      );

      // Assert
      expect(result).toBe('english-content');
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'CONDITIONAL node cond-lang-en: language = en = true',
      );
    });

    it('should handle nested field access in conditions', () => {
      // Arrange
      const nestedCondition = TestFixtures.TEST_NODES.CONDITIONAL.NESTED_FIELD;

      // Act
      const result = service.processNode(
        nestedCondition,
        TestFixtures.COMPLEX_NESTED_PATIENT,
      );

      // Assert
      expect(result).toBe('senior-care');
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'CONDITIONAL node cond-nested: demographics.age > 60 = true',
      );
    });

    it('should handle invalid operators gracefully', () => {
      // Arrange
      const invalidCondition =
        TestFixtures.TEST_NODES.CONDITIONAL.INVALID_OPERATOR;

      // Act
      const result = service.processNode(
        invalidCondition,
        TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT,
      );

      // Assert
      expect(result).toBe('false-path');
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Unknown operator: invalid_op',
      );
    });
  });

  describe('Database Integration - handleDelayNode()', () => {
    it('should save delay node scheduling to database', async () => {
      // Arrange
      const runId = 'test-run-123';
      const delayNode = TestFixtures.TEST_NODES.DELAY.SHORT;
      const expectedResumeTime = new Date(Date.now() + 300 * 1000);

      // Act
      await service.handleDelayNode(runId, delayNode);

      // Assert
      expect(databaseService.save).toHaveBeenCalledWith(JourneyRun, {
        runId: 'test-run-123',
        status: JourneyRunStatus.WAITING_DELAY,
        currentNodeId: 'delay-short',
        resumeAt: expect.any(Date),
      });

      const saveCall = (databaseService.save as jest.Mock).mock.calls[0];
      const savedData = saveCall[1];
      expect(savedData.resumeAt.getTime()).toBeCloseTo(
        expectedResumeTime.getTime(),
        -2, // Allow 2 seconds tolerance
      );

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('DELAY node delay-short: Scheduled resume at'),
      );
    });

    it('should handle database save errors in handleDelayNode', async () => {
      // Arrange
      const runId = 'error-run-456';
      const delayNode = TestFixtures.TEST_NODES.DELAY.LONG;
      setupDatabaseError('Save failed');

      // Act & Assert
      await expect(service.handleDelayNode(runId, delayNode)).rejects.toThrow(
        'Save failed',
      );

      expect(databaseService.save).toHaveBeenCalledWith(JourneyRun, {
        runId: 'error-run-456',
        status: JourneyRunStatus.WAITING_DELAY,
        currentNodeId: 'delay-long',
        resumeAt: expect.any(Date),
      });
    });
  });
});
