import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JourneyService } from '../services/journey.service';
import { JourneyExecutionService } from '../services/journey-execution.service';
import { NodeType } from '../enums/node-type.enum';
import {
  Journey,
  PatientContext,
  JourneyRun,
} from '../interfaces/journey.interface';

@ApiTags('journeys')
@Controller('journeys')
export class JourneyController {
  constructor(
    private readonly journeyService: JourneyService,
    private readonly journeyExecutionService: JourneyExecutionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new journey',
    description: 'Creates and stores a new journey definition',
  })
  @ApiBody({
    description: 'Journey definition',
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          example: 'Hip Replacement Recovery Journey',
        },
        start_node_id: {
          type: 'string',
          example: 'welcome_message',
        },
        nodes: {
          type: 'array',
          items: {
            oneOf: [
              {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'welcome_message' },
                  type: { type: 'string', enum: [NodeType.MESSAGE] },
                  message: {
                    type: 'string',
                    example: 'Welcome to your recovery journey!',
                  },
                  next_node_id: { type: 'string', example: 'wait_180' },
                },
              },
              {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'wait_180' },
                  type: { type: 'string', enum: [NodeType.DELAY] },
                  duration_seconds: { type: 'number', example: 180 },
                  next_node_id: { type: 'string', example: 'check_age' },
                },
              },
              {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'check_age' },
                  type: { type: 'string', enum: [NodeType.CONDITIONAL] },
                  condition: {
                    type: 'object',
                    properties: {
                      field: { type: 'string', example: 'patient.age' },
                      operator: { type: 'string', example: '>' },
                      value: { type: 'number', example: 65 },
                    },
                  },
                  on_true_next_node_id: {
                    type: 'string',
                    example: 'over_65',
                  },
                  on_false_next_node_id: {
                    type: 'string',
                    example: 'less_than_65',
                  },
                },
              },
            ],
          },
        },
      },
      required: ['name', 'start_node_id', 'nodes'],
      example: {
        name: 'Hip Replacement Recovery Journey',
        start_node_id: 'welcome_message',
        nodes: [
          {
            id: 'welcome_message',
            type: 'MESSAGE',
            message: 'Welcome to your recovery journey!',
            next_node_id: 'wait_180',
          },
          {
            id: 'wait_180',
            type: 'DELAY',
            duration_seconds: 180,
            next_node_id: 'check_age',
          },
          {
            id: 'check_age',
            type: 'CONDITIONAL',
            condition: {
              field: 'patient.age',
              operator: '>',
              value: 65,
            },
            on_true_next_node_id: 'over_65',
            on_false_next_node_id: 'less_than_65',
          },
          {
            id: 'over_65',
            type: 'MESSAGE',
            message: 'you are over 65',
          },
          {
            id: 'less_than_65',
            type: 'MESSAGE',
            message: 'you are less than 65',
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Journey created successfully',
    schema: {
      type: 'object',
      properties: {
        journeyId: {
          type: 'string',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
      },
    },
  })
  async createJourney(
    @Body() journeyData: Omit<Journey, 'id'>,
  ): Promise<{ journeyId: string }> {
    const journeyId = await this.journeyService.createJourney(journeyData);
    return { journeyId };
  }

  @Post(':journeyId/trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Trigger a journey execution',
    description:
      'Starts a new execution run of a specific journey for a patient',
  })
  @ApiParam({
    name: 'journeyId',
    description: 'The ID of the journey to trigger',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    description: 'Patient context data',
    schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          example: 'patient_123',
        },
        age: {
          type: 'number',
          example: 72,
        },
        language: {
          type: 'string',
          enum: ['en', 'es'],
          example: 'en',
        },
        condition: {
          type: 'string',
          enum: ['hip_replacement', 'knee_replacement'],
          example: 'hip_replacement',
        },
      },
      required: ['id', 'age', 'language', 'condition'],
    },
  })
  @ApiResponse({
    status: 202,
    description: 'Journey execution started',
    schema: {
      type: 'object',
      properties: {
        runId: {
          type: 'string',
          example: '456e7890-e89b-12d3-a456-426614174001',
        },
      },
    },
    headers: {
      Location: {
        description: 'URL to monitor the journey run',
        schema: {
          type: 'string',
          example: '/journeys/runs/456e7890-e89b-12d3-a456-426614174001',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Journey not found',
  })
  async triggerJourney(
    @Param('journeyId') journeyId: string,
    @Body() patientContext: PatientContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ runId: string }> {
    const runId = await this.journeyExecutionService.triggerJourney(
      journeyId,
      patientContext,
    );

    // Set the Location header pointing to the monitoring endpoint
    res.header('Location', `/journeys/runs/${runId}`);

    return { runId };
  }

  @Get('runs/:runId')
  @ApiOperation({
    summary: 'Get journey run status',
    description: 'Monitors the status of a specific journey run',
  })
  @ApiParam({
    name: 'runId',
    description: 'The ID of the journey run to monitor',
    example: '456e7890-e89b-12d3-a456-426614174001',
  })
  @ApiResponse({
    status: 200,
    description: 'Journey run status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        runId: {
          type: 'string',
          example: '456e7890-e89b-12d3-a456-426614174001',
        },
        status: {
          type: 'string',
          enum: ['in_progress', 'completed', 'failed'],
          example: 'in_progress',
        },
        currentNodeId: {
          type: 'string',
          nullable: true,
          example: 'check_age',
        },
        patientContext: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'patient_123' },
            age: { type: 'number', example: 72 },
            language: { type: 'string', example: 'en' },
            condition: { type: 'string', example: 'hip_replacement' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Journey run not found',
  })
  async getJourneyRun(@Param('runId') runId: string): Promise<JourneyRun> {
    return this.journeyService.getJourneyRun(runId);
  }
}
