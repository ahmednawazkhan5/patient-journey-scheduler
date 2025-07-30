import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { JourneyController } from './journey.controller';
import { JourneyService } from '../services/journey.service';
import { JourneyExecutionService } from '../services/journey-execution.service';
import { JourneyRunStatus } from '../enums/journey-run-status.enum';
import { TestFixtures, MockHelpers } from '../../test/utils';

describe('JourneyController', () => {
  let controller: JourneyController;
  let journeyService: Partial<JourneyService>;
  let journeyExecutionService: Partial<JourneyExecutionService>;

  // Helper to create mock Response object
  const createMockResponse = (): Partial<Response> => ({
    header: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  });

  beforeEach(async () => {
    const mockJourneyService = MockHelpers.createMockJourneyService();
    const mockJourneyExecutionService =
      MockHelpers.createMockJourneyExecutionService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [JourneyController],
      providers: [
        {
          provide: JourneyService,
          useValue: mockJourneyService,
        },
        {
          provide: JourneyExecutionService,
          useValue: mockJourneyExecutionService,
        },
      ],
    }).compile();

    controller = module.get<JourneyController>(JourneyController);
    journeyService = module.get(JourneyService);
    journeyExecutionService = module.get(JourneyExecutionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createJourney', () => {
    it('should create a journey successfully', async () => {
      // Arrange
      const expectedJourneyId = 'journey-123';
      const mockJourneyData = TestFixtures.JOURNEYS.LINEAR_JOURNEY;
      (journeyService.createJourney as jest.Mock).mockResolvedValue(
        expectedJourneyId,
      );

      // Act
      const result = await controller.createJourney(mockJourneyData);

      // Assert
      expect(journeyService.createJourney).toHaveBeenCalledWith(
        mockJourneyData,
      );
      expect(journeyService.createJourney).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        journeyId: expectedJourneyId,
      });
    });

    it('should handle journey creation failure', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      const mockJourneyData = TestFixtures.JOURNEYS.CONDITIONAL_JOURNEY;
      (journeyService.createJourney as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(controller.createJourney(mockJourneyData)).rejects.toThrow(
        'Database connection failed',
      );
      expect(journeyService.createJourney).toHaveBeenCalledWith(
        mockJourneyData,
      );
    });
  });

  describe('triggerJourney', () => {
    it('should trigger a journey successfully', async () => {
      // Arrange
      const journeyId = 'journey-123';
      const expectedRunId = 'run-789';
      const mockPatientContext = TestFixtures.PATIENT_CONTEXTS.SENIOR_PATIENT;
      const mockResponse = createMockResponse();
      (journeyExecutionService.triggerJourney as jest.Mock).mockResolvedValue(
        expectedRunId,
      );

      // Act
      const result = await controller.triggerJourney(
        journeyId,
        mockPatientContext,
        mockResponse as Response,
      );

      // Assert
      expect(journeyExecutionService.triggerJourney).toHaveBeenCalledWith(
        journeyId,
        mockPatientContext,
      );
      expect(journeyExecutionService.triggerJourney).toHaveBeenCalledTimes(1);
      expect(mockResponse.header).toHaveBeenCalledWith(
        'Location',
        `/journeys/runs/${expectedRunId}`,
      );
      expect(result).toEqual({
        runId: expectedRunId,
      });
    });

    it('should handle journey not found error', async () => {
      // Arrange
      const journeyId = 'non-existent-journey';
      const error = new Error('Journey not found');
      const mockPatientContext = TestFixtures.PATIENT_CONTEXTS.YOUNG_PATIENT;
      const mockResponse = createMockResponse();
      (journeyExecutionService.triggerJourney as jest.Mock).mockRejectedValue(
        error,
      );

      // Act & Assert
      await expect(
        controller.triggerJourney(
          journeyId,
          mockPatientContext,
          mockResponse as Response,
        ),
      ).rejects.toThrow('Journey not found');
      expect(journeyExecutionService.triggerJourney).toHaveBeenCalledWith(
        journeyId,
        mockPatientContext,
      );
    });
  });

  describe('getJourneyRun', () => {
    it('should return journey run status successfully', async () => {
      // Arrange
      const runId = 'run-789';
      const mockJourneyRun = TestFixtures.createMockJourneyRun();
      (journeyService.getJourneyRun as jest.Mock).mockResolvedValue(
        mockJourneyRun,
      );

      // Act
      const result = await controller.getJourneyRun(runId);

      // Assert
      expect(journeyService.getJourneyRun).toHaveBeenCalledWith(runId);
      expect(journeyService.getJourneyRun).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockJourneyRun);
    });

    it('should handle journey run not found', async () => {
      // Arrange
      const runId = 'non-existent-run';
      const error = new Error('Journey run not found');
      (journeyService.getJourneyRun as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getJourneyRun(runId)).rejects.toThrow(
        'Journey run not found',
      );
      expect(journeyService.getJourneyRun).toHaveBeenCalledWith(runId);
    });

    it('should handle different journey run statuses', async () => {
      // Test completed status
      const completedRun = TestFixtures.createMockJourneyRun({
        status: JourneyRunStatus.COMPLETED,
      });
      (journeyService.getJourneyRun as jest.Mock).mockResolvedValue(
        completedRun,
      );

      const result = await controller.getJourneyRun('run-789');
      expect(result.status).toBe(JourneyRunStatus.COMPLETED);

      // Test failed status
      const failedRun = TestFixtures.createMockJourneyRun({
        status: JourneyRunStatus.FAILED,
      });
      (journeyService.getJourneyRun as jest.Mock).mockResolvedValue(failedRun);

      const failedResult = await controller.getJourneyRun('run-789');
      expect(failedResult.status).toBe(JourneyRunStatus.FAILED);
    });
  });
});
