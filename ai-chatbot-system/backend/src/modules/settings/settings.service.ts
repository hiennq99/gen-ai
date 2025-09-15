import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SettingsService {
  constructor(private readonly configService: ConfigService) {}

  async getSettings() {
    return {
      general: {
        siteName: 'AI Chatbot Admin',
        language: 'en',
        timezone: 'UTC',
      },
      ai: {
        model: this.configService.get('aws.bedrock.modelId'),
        temperature: this.configService.get('aws.bedrock.temperature'),
        maxTokens: this.configService.get('aws.bedrock.maxTokens'),
        responseTime: this.configService.get('performance.targetResponseTime'),
        responseMode: 'hybrid', // Default response mode
        priorityMode: 'qa_first', // Q&A priority mode
      },
      notifications: {
        emailEnabled: true,
        webhookEnabled: false,
        slackEnabled: false,
      },
      security: {
        twoFactorEnabled: false,
        sessionTimeout: 3600,
        ipWhitelist: [],
      },
      limits: {
        maxFileSize: 10485760, // 10MB
        maxConversationLength: 100,
        rateLimitPerMinute: 60,
      },
    };
  }

  async updateSettings(settings: any) {
    // In a real implementation, this would save to database
    // For now, we'll just return the updated settings
    return {
      success: true,
      message: 'Settings updated successfully',
      settings,
    };
  }
}