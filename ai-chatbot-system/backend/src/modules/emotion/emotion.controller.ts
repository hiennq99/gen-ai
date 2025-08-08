import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { EmotionService } from './emotion.service';
import { EmotionAnalysisDto } from './dto/emotion-analysis.dto';

@ApiTags('emotion')
@Controller('emotion')
export class EmotionController {
  constructor(private readonly emotionService: EmotionService) {}

  @Post('analyze')
  @ApiOperation({ summary: 'Analyze emotion from text' })
  @ApiBody({ type: EmotionAnalysisDto })
  @ApiResponse({ status: 200, description: 'Emotion analysis result' })
  async analyzeEmotion(@Body() dto: EmotionAnalysisDto) {
    return await this.emotionService.analyzeEmotion(dto.text);
  }
}