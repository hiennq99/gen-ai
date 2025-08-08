import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SearchService } from '../search/search.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly searchService: SearchService,
  ) {}

  async getStats() {
    const [conversations, documents] = await Promise.all([
      this.databaseService.getConversationHistory('*'), // Get all conversations
      this.databaseService.listDocuments(),
    ]);

    const uniqueUsers = new Set(conversations.map((c: any) => c.userId)).size;
    
    // Calculate average response time
    const responseTimes = conversations
      .filter((c: any) => c.processingTime)
      .map((c: any) => c.processingTime);
    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;

    // Get daily chat counts for last 7 days
    const dailyChats = this.getDailyChats(conversations);
    
    // Get emotion distribution
    const emotionDistribution = this.getEmotionDistribution(conversations);

    return {
      totalConversations: conversations.length,
      activeUsers: uniqueUsers,
      totalDocuments: documents.length,
      avgResponseTime,
      dailyChats,
      emotionDistribution,
    };
  }

  async getRecentConversations(limit = 10) {
    const conversations = await this.databaseService.getConversationHistory('*');
    return conversations
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  private getDailyChats(conversations: any[]) {
    const dailyMap = new Map<string, number>();
    const now = new Date();
    
    // Initialize last 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyMap.set(dateStr, 0);
    }

    // Count conversations per day
    conversations.forEach((conv: any) => {
      const date = new Date(conv.createdAt).toISOString().split('T')[0];
      if (dailyMap.has(date)) {
        dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
      }
    });

    return Array.from(dailyMap.entries())
      .map(([date, count]) => ({ date, count }))
      .reverse();
  }

  private getEmotionDistribution(conversations: any[]) {
    const emotionMap = new Map<string, number>();
    
    conversations.forEach((conv: any) => {
      if (conv.emotion) {
        emotionMap.set(conv.emotion, (emotionMap.get(conv.emotion) || 0) + 1);
      }
    });

    return Array.from(emotionMap.entries()).map(([type, value]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      value,
    }));
  }
}