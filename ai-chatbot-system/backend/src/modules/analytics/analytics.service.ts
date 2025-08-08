import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getAnalytics(_params?: any) {
    const conversations = await this.databaseService.getConversationHistory('*');
    
    const uniqueUsers = new Set(conversations.map((c: any) => c.userId)).size;
    
    // Calculate metrics
    const responseTimes = conversations
      .filter((c: any) => c.processingTime)
      .map((c: any) => c.processingTime);
    
    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;

    const successfulConversations = conversations.filter((c: any) => c.confidence > 70).length;
    const successRate = conversations.length > 0
      ? Math.round((successfulConversations / conversations.length) * 100)
      : 0;

    return {
      totalConversations: conversations.length,
      uniqueUsers,
      avgResponseTime,
      successRate,
      responseTime: this.getResponseTimeTrend(conversations),
      emotionDistribution: this.getEmotionDistribution(conversations),
      hourlyActivity: this.getHourlyActivity(conversations),
      confidenceScore: this.getConfidenceTrend(conversations),
    };
  }

  async getMetrics(metric: string, _params?: any) {
    const conversations = await this.databaseService.getConversationHistory('*');
    
    switch (metric) {
      case 'response-time':
        return this.getResponseTimeTrend(conversations);
      case 'emotions':
        return this.getEmotionDistribution(conversations);
      case 'activity':
        return this.getHourlyActivity(conversations);
      case 'confidence':
        return this.getConfidenceTrend(conversations);
      default:
        return null;
    }
  }

  async generateReport(params: any) {
    const analytics = await this.getAnalytics(params);
    
    return {
      generatedAt: new Date().toISOString(),
      period: params.period || 'last-30-days',
      metrics: analytics,
      recommendations: this.generateRecommendations(analytics),
    };
  }

  private getResponseTimeTrend(conversations: any[]) {
    const dailyMap = new Map<string, number[]>();
    
    conversations.forEach((conv: any) => {
      if (conv.processingTime && conv.createdAt) {
        const date = new Date(conv.createdAt).toISOString().split('T')[0];
        if (!dailyMap.has(date)) {
          dailyMap.set(date, []);
        }
        dailyMap.get(date)?.push(conv.processingTime);
      }
    });

    return Array.from(dailyMap.entries())
      .map(([date, times]) => ({
        date,
        avgTime: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // Last 30 days
  }

  private getEmotionDistribution(conversations: any[]) {
    const emotionMap = new Map<string, number>();
    
    conversations.forEach((conv: any) => {
      if (conv.emotion) {
        emotionMap.set(conv.emotion, (emotionMap.get(conv.emotion) || 0) + 1);
      }
    });

    return Array.from(emotionMap.entries()).map(([emotion, count]) => ({
      emotion: emotion.charAt(0).toUpperCase() + emotion.slice(1),
      count,
    }));
  }

  private getHourlyActivity(conversations: any[]) {
    const hourlyMap = new Map<number, number>();
    
    // Initialize all hours
    for (let i = 0; i < 24; i++) {
      hourlyMap.set(i, 0);
    }
    
    conversations.forEach((conv: any) => {
      if (conv.createdAt) {
        const hour = new Date(conv.createdAt).getHours();
        hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
      }
    });

    return Array.from(hourlyMap.entries()).map(([hour, count]) => ({
      hour: `${hour}:00`,
      count,
    }));
  }

  private getConfidenceTrend(conversations: any[]) {
    const dailyMap = new Map<string, number[]>();
    
    conversations.forEach((conv: any) => {
      if (conv.confidence && conv.createdAt) {
        const date = new Date(conv.createdAt).toISOString().split('T')[0];
        if (!dailyMap.has(date)) {
          dailyMap.set(date, []);
        }
        dailyMap.get(date)?.push(conv.confidence);
      }
    });

    return Array.from(dailyMap.entries())
      .map(([date, scores]) => ({
        date,
        confidence: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // Last 30 days
  }

  private generateRecommendations(analytics: any) {
    const recommendations = [];
    
    if (analytics.avgResponseTime > 5000) {
      recommendations.push({
        type: 'performance',
        message: 'Response time is above target. Consider optimizing cache or scaling resources.',
        priority: 'high',
      });
    }
    
    if (analytics.successRate < 70) {
      recommendations.push({
        type: 'accuracy',
        message: 'Success rate is below 70%. Consider adding more training data.',
        priority: 'high',
      });
    }
    
    return recommendations;
  }
}