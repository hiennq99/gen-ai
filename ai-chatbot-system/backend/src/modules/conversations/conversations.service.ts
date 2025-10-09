import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SearchService } from '../search/search.service';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly searchService: SearchService,
  ) {}

  async getConversations(filters?: any) {
    const conversations = await this.databaseService.getConversationHistory('*');
    
    let filtered = conversations;
    
    // Apply filters
    if (filters?.search) {
      filtered = filtered.filter((c: any) => 
        c.userMessage?.toLowerCase().includes(filters.search.toLowerCase()) ||
        c.assistantMessage?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }
    
    if (filters?.emotion) {
      filtered = filtered.filter((c: any) => c.emotion?.primaryEmotion === filters.emotion);
    }
    
    if (filters?.dateRange) {
      const [startDate, endDate] = filters.dateRange;
      filtered = filtered.filter((c: any) => {
        const convDate = new Date(c.createdAt);
        return convDate >= new Date(startDate) && convDate <= new Date(endDate);
      });
    }

    // Transform data for frontend
    return this.transformConversations(filtered);
  }

  async getConversation(sessionId: string) {
    const history = await this.databaseService.getConversationHistory(sessionId);

    if (!history || history.length === 0) {
      return [];
    }

    // Generate title from first user message
    const firstUserMessage = history[0]?.userMessage;
    const title = firstUserMessage ?
      (firstUserMessage.length > 50 ?
        firstUserMessage.substring(0, 50) + '...' :
        firstUserMessage) :
      'Chat Session';

    // Return history with title and transformed messages
    return {
      title,
      messages: this.buildMessages(history),
    };
  }

  async exportConversations(filters: any) {
    const conversations = await this.getConversations(filters);
    
    // Format for export (CSV, JSON, etc.)
    const exportData = conversations.map((conv: any) => ({
      sessionId: conv.sessionId,
      userId: conv.userId,
      messageCount: conv.messageCount,
      dominantEmotion: conv.dominantEmotion,
      avgConfidence: conv.avgConfidence,
      duration: conv.duration,
      startedAt: conv.startedAt,
      rating: conv.rating,
    }));

    return {
      data: exportData,
      exportedAt: new Date().toISOString(),
      count: exportData.length,
    };
  }

  async deleteConversation(sessionId: string) {
    // Implementation would delete from database
    // For now, return success
    return { success: true, sessionId };
  }

  private transformConversations(conversations: any[]) {
    // Group by session
    const sessionMap = new Map<string, any[]>();

    conversations.forEach((conv: any) => {
      const sessionId = conv.sessionId || 'default';
      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, []);
      }
      sessionMap.get(sessionId)?.push(conv);
    });

    // Transform to frontend format
    return Array.from(sessionMap.entries()).map(([sessionId, convs]) => {
      // Sort by timestamp to ensure chronological order
      convs.sort((a, b) => {
        const timeA = new Date(a.createdAtISO || a.createdAt).getTime();
        const timeB = new Date(b.createdAtISO || b.createdAt).getTime();
        return timeA - timeB;
      });

      const emotions = convs.map((c: any) => c.emotion?.primaryEmotion).filter(Boolean);
      const confidences = convs.map((c: any) => c.confidence).filter(Boolean);

      const dominantEmotion = this.getMostFrequent(emotions) || 'neutral';
      const avgConfidence = confidences.length > 0
        ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
        : 0;

      // Use the EARLIEST message timestamp as start time (first message after sorting)
      const startTime = new Date(convs[0].createdAtISO || convs[0].createdAt);
      const endTime = new Date(convs[convs.length - 1].createdAtISO || convs[convs.length - 1].createdAt);
      const duration = (endTime.getTime() - startTime.getTime()) / 1000; // in seconds

      // Generate title from first user message
      const firstUserMessage = convs[0].userMessage;
      const title = firstUserMessage ?
        (firstUserMessage.length > 50 ?
          firstUserMessage.substring(0, 50) + '...' :
          firstUserMessage) :
        'Chat Session';

      return {
        sessionId,
        title,
        userId: convs[0].userId,
        messageCount: convs.length * 2, // user + assistant messages
        dominantEmotion,
        avgConfidence,
        duration,
        startedAt: convs[0].createdAtISO || convs[0].createdAt,
        rating: convs[0].rating || null,
        messages: this.buildMessages(convs),
      };
    }).sort((a, b) => {
      // Sort by startedAt (most recent first)
      const timeA = new Date(a.startedAt).getTime();
      const timeB = new Date(b.startedAt).getTime();
      return timeB - timeA;
    });
  }

  private buildMessages(conversations: any[]) {
    return conversations.map((conv: any) => [
      {
        role: 'user',
        content: conv.userMessage,
        timestamp: conv.createdAt,
        emotion: conv.emotion?.primaryEmotion,
        emotionAnalysis: conv.emotion ? {
          primaryEmotion: conv.emotion.primaryEmotion,
          secondaryEmotions: conv.emotion.secondaryEmotions,
          intensity: conv.emotion.intensity,
          confidence: conv.emotion.confidence,
          aiEnhanced: conv.emotion.aiEnhanced,
        } : null,
        emotionTags: conv.emotionTags,
      },
      {
        role: 'assistant',
        content: conv.assistantMessage,
        timestamp: new Date(new Date(conv.createdAt).getTime() + (conv.processingTime || 1000)).toISOString(),
        confidence: conv.confidence,
        media: conv.metadata?.media || [], // Include media from metadata
        emotionTags: conv.emotionTags,
      },
    ]).flat();
  }

  private getMostFrequent(arr: string[]): string | null {
    if (arr.length === 0) return null;
    
    const frequency = arr.reduce((acc: any, val: string) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});

    return Object.keys(frequency).reduce((a, b) => 
      frequency[a] > frequency[b] ? a : b
    );
  }
}