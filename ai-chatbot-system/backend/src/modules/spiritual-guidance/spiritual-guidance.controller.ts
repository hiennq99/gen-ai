import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Logger,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SpiritualGuidanceService } from './spiritual-guidance.service';
import { CitationService } from './citation.service';
import { EmotionMappingService } from './emotion-mapping.service';
import {
  SpiritualGuidanceRequest,
  SpiritualGuidanceResponse,
} from './interfaces/spiritual-guidance.interface';

@ApiTags('spiritual-guidance')
@Controller('spiritual-guidance')
export class SpiritualGuidanceController {
  private readonly logger = new Logger(SpiritualGuidanceController.name);

  constructor(
    private readonly spiritualGuidanceService: SpiritualGuidanceService,
    private readonly citationService: CitationService,
    private readonly emotionMappingService: EmotionMappingService,
  ) {}

  @Post('guidance')
  @ApiOperation({ summary: 'Get spiritual guidance with citations' })
  @ApiResponse({
    status: 200,
    description: 'Spiritual guidance provided successfully',
    type: Object,
  })
  async getSpiritualGuidance(
    @Body() request: SpiritualGuidanceRequest,
  ): Promise<SpiritualGuidanceResponse> {
    try {
      this.logger.log('Spiritual guidance requested', {
        messageLength: request.message?.length,
        hasEmotionalState: !!request.emotionalState,
      });

      const response = await this.spiritualGuidanceService.provideSpiritualGuidance(request);

      this.logger.log('Spiritual guidance provided', {
        citationLevel: response.citationLevel,
        citationCount: response.citations.length,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to provide spiritual guidance', error);
      throw error;
    }
  }

  @Post('emotion-analysis')
  @ApiOperation({ summary: 'Analyze emotional state for spiritual mapping' })
  @ApiResponse({
    status: 200,
    description: 'Emotional analysis completed',
    type: Object,
  })
  async analyzeEmotion(@Body() body: { message: string }) {
    try {
      const emotionalState = await this.emotionMappingService.analyzeEmotionalState(
        body.message,
      );

      this.logger.log('Emotion analysis completed', {
        primaryEmotion: emotionalState.primaryEmotion,
        intensity: emotionalState.intensity,
      });

      return {
        success: true,
        data: emotionalState,
      };
    } catch (error) {
      this.logger.error('Failed to analyze emotion', error);
      throw error;
    }
  }

  @Get('spiritual-diseases')
  @ApiOperation({ summary: 'Get all available spiritual diseases' })
  @ApiResponse({
    status: 200,
    description: 'List of spiritual diseases',
    type: Array,
  })
  async getSpiritualDiseases() {
    try {
      const diseases = this.citationService.getAllSpiritualDiseases();

      return {
        success: true,
        data: diseases,
        count: diseases.length,
      };
    } catch (error) {
      this.logger.error('Failed to get spiritual diseases', error);
      throw error;
    }
  }

  @Get('spiritual-diseases/:name')
  @ApiOperation({ summary: 'Get specific spiritual disease information' })
  @ApiResponse({
    status: 200,
    description: 'Spiritual disease information',
    type: Object,
  })
  async getSpiritualDisease(@Param('name') name: string) {
    try {
      const disease = this.citationService.getSpiritualDiseaseByName(name);

      if (!disease) {
        return {
          success: false,
          message: `Spiritual disease '${name}' not found`,
        };
      }

      return {
        success: true,
        data: disease,
      };
    } catch (error) {
      this.logger.error('Failed to get spiritual disease', error);
      throw error;
    }
  }

  @Post('pattern-analysis')
  @ApiOperation({ summary: 'Analyze emotional patterns from message history' })
  @ApiResponse({
    status: 200,
    description: 'Emotional patterns analyzed',
    type: Array,
  })
  async analyzeEmotionalPatterns(@Body() body: { messages: string[] }) {
    try {
      if (!body.messages || !Array.isArray(body.messages)) {
        throw new Error('Messages array is required');
      }

      const patterns = await this.emotionMappingService.detectEmotionalPatterns(
        body.messages,
      );

      this.logger.log('Emotional patterns analyzed', {
        messageCount: body.messages.length,
        patternCount: patterns.length,
      });

      return {
        success: true,
        data: patterns,
      };
    } catch (error) {
      this.logger.error('Failed to analyze emotional patterns', error);
      throw error;
    }
  }

  @Post('test-citation')
  @ApiOperation({ summary: 'Test citation matching system' })
  @ApiResponse({
    status: 200,
    description: 'Citation match results',
    type: Object,
  })
  async testCitationMatching(@Body() body: { message: string; emotion?: string }) {
    try {
      // Get emotional state
      const emotionalState = await this.emotionMappingService.analyzeEmotionalState(
        body.message,
      );

      // Override emotion if provided
      if (body.emotion) {
        emotionalState.primaryEmotion = body.emotion;
      }

      // Find citation match
      const citationMatch = await this.citationService.findCitationMatch(
        emotionalState,
        body.message,
      );

      return {
        success: true,
        data: {
          emotionalState,
          citationMatch,
          message: body.message,
        },
      };
    } catch (error) {
      this.logger.error('Failed to test citation matching', error);
      throw error;
    }
  }

  @Post('quality-audit')
  @ApiOperation({ summary: 'Audit spiritual guidance response quality' })
  @ApiResponse({
    status: 200,
    description: 'Quality audit completed',
    type: Object,
  })
  async auditResponseQuality(@Body() body: {
    response: SpiritualGuidanceResponse;
    originalMessage: string;
  }) {
    try {
      const auditResult = await this.spiritualGuidanceService['qualityControlService']
        .auditResponse(body.response, body.originalMessage);

      return {
        success: true,
        data: auditResult,
      };
    } catch (error) {
      this.logger.error('Failed to audit response quality', error);
      throw error;
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check for spiritual guidance service' })
  @ApiResponse({
    status: 200,
    description: 'Service health status',
    type: Object,
  })
  async healthCheck() {
    try {
      const diseases = this.citationService.getAllSpiritualDiseases();

      return {
        success: true,
        status: 'healthy',
        spiritualDiseasesLoaded: diseases.length,
        timestamp: new Date().toISOString(),
        features: {
          citationBasedGuidance: true,
          emotionalStateMapping: true,
          qualityControl: true,
          progressiveCitationStrategy: true,
        },
      };
    } catch (error) {
      this.logger.error('Health check failed', error);
      return {
        success: false,
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}