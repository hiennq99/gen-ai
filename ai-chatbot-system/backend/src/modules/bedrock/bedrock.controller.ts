import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BedrockService } from './bedrock.service';

@ApiTags('bedrock')
@Controller('bedrock')
export class BedrockController {
  constructor(private readonly bedrockService: BedrockService) {}

  @Get('health')
  @ApiOperation({ summary: 'Check Bedrock connection health' })
  @ApiResponse({ status: 200, description: 'Connection status' })
  async checkHealth() {
    const isConnected = await this.bedrockService.testConnection();
    return {
      status: isConnected ? 'healthy' : 'unhealthy',
      service: 'AWS Bedrock',
      timestamp: new Date().toISOString(),
    };
  }
}