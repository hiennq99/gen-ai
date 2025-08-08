import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BedrockService } from '../bedrock/bedrock.service';
import { EmotionService } from '../emotion/emotion.service';
import { SearchService } from '../search/search.service';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../cache/cache.service';
import { ChatRequest, ChatResponse, ChatSession } from './interfaces/chat.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly MAX_CONTEXT_LENGTH = 10000;
  private readonly TARGET_RESPONSE_TIME = 5000; // 5 seconds

  constructor(
    private readonly configService: ConfigService,
    private readonly bedrockService: BedrockService,
    private readonly emotionService: EmotionService,
    private readonly searchService: SearchService,
    private readonly databaseService: DatabaseService,
    private readonly cacheService: CacheService,
  ) {}

  async processMessage(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    const messageId = uuidv4();

    try {
      // Check cache first
      const cachedResponse = await this.getCachedResponse(request.message);
      if (cachedResponse) {
        this.logger.debug('Returning cached response');
        return cachedResponse;
      }

      // Analyze emotion
      const emotionAnalysis = await this.emotionService.analyzeEmotion(request.message);
      this.logger.debug(`Detected emotion: ${emotionAnalysis.primaryEmotion}`);

      // Search for relevant context
      const searchResults = await this.searchService.searchDocuments({
        query: request.message,
        emotion: emotionAnalysis.primaryEmotion,
        limit: 5,
        minScore: 0.7,
      });

      // Check if exact match mode is enabled (return raw document content)
      const exactMatchMode = request.metadata?.exactMatch || 
                            request.metadata?.mode === 'exact' ||
                            this.configService.get('chat.exactMatchMode', false);
      
      this.logger.log(`Mode: ${request.metadata?.mode}, Exact match: ${exactMatchMode}, Search results: ${searchResults.length}`);
      
      if (exactMatchMode && searchResults.length > 0) {
        // Return the exact content from the best matching document
        const bestMatch = searchResults[0];
        const exactContent = bestMatch.content || bestMatch.text || 'No exact match found.';
        
        this.logger.log('Returning exact document match without AI interpretation');
        
        // Format as direct response
        const response: ChatResponse = {
          id: messageId,
          content: exactContent,
          media: [],
          emotion: emotionAnalysis.primaryEmotion,
          confidence: bestMatch.score ? bestMatch.score * 100 : 100,
          processingTime: Date.now() - startTime,
          metadata: {
            sessionId: request.sessionId,
            emotionAnalysis,
            documentsUsed: 1,
            documents: [{
              title: bestMatch.title || bestMatch.documentId || 'Document',
              relevanceScore: bestMatch.score ? (bestMatch.score * 100).toFixed(1) + '%' : '100%',
              excerpt: exactContent.substring(0, 200) + '...',
            }],
            cached: false,
            contextInfo: {
              totalDocuments: searchResults.length,
              contextUsed: true,
              message: `Exact match from document (no AI interpretation)`,
            },
            mode: 'exact-match',
          },
        };
        
        // Save conversation
        await this.saveConversation({
          messageId,
          sessionId: request.sessionId,
          userId: request.userId,
          userMessage: request.message,
          assistantMessage: exactContent,
          emotion: emotionAnalysis,
          processingTime: Date.now() - startTime,
          metadata: {
            mode: 'exact-match',
            documentId: bestMatch.documentId,
          },
        });
        
        return response;
      }

      // Build context from search results
      const context = this.buildContext(searchResults, emotionAnalysis);

      // Get conversation history
      const history = await this.getConversationHistory(request.sessionId || '');

      // Prepare messages for Claude
      const messages = this.prepareMessages(request.message, history);

      // Get emotion-based system prompt
      const emotionContext = this.emotionService.getEmotionContext(emotionAnalysis.primaryEmotion);
      const systemPrompt = this.buildSystemPrompt(emotionContext, request.metadata);

      // Query Claude with context
      const claudeResponse = await this.bedrockService.invokeModel({
        messages,
        context,
        systemPrompt,
        metadata: {
          userId: request.userId,
          sessionId: request.sessionId,
          emotion: emotionAnalysis.primaryEmotion,
        },
      });

      // Format response with media
      const formattedResponse = await this.formatResponse(
        claudeResponse.content,
        searchResults,
        emotionAnalysis,
      );

      // Save to database
      await this.saveConversation({
        messageId,
        sessionId: request.sessionId,
        userId: request.userId,
        userMessage: request.message,
        assistantMessage: formattedResponse.content,
        emotion: emotionAnalysis,
        processingTime: Date.now() - startTime,
        metadata: {
          modelUsed: claudeResponse.modelId,
          tokensUsed: claudeResponse.usage,
          contextUsed: context.substring(0, 200),
        },
      });

      // Cache response if applicable
      if (emotionAnalysis.confidence > 80) {
        await this.cacheResponse(request.message, formattedResponse);
      }

      // Extract document information for transparency
      const documentsUsed = searchResults.map((result: any) => ({
        title: result.title || result.documentId || 'Unknown Document',
        relevanceScore: result.score ? (result.score * 100).toFixed(1) + '%' : 'N/A',
        excerpt: result.content ? result.content.substring(0, 100) + '...' : '',
      }));

      const response: ChatResponse = {
        id: messageId,
        content: formattedResponse.content,
        media: formattedResponse.media,
        emotion: emotionAnalysis.primaryEmotion,
        confidence: this.calculateResponseConfidence(searchResults, emotionAnalysis),
        processingTime: Date.now() - startTime,
        metadata: {
          sessionId: request.sessionId,
          emotionAnalysis,
          documentsUsed: searchResults.length,
          documents: documentsUsed,
          cached: false,
          contextInfo: {
            totalDocuments: searchResults.length,
            contextUsed: searchResults.length > 0,
            message: searchResults.length > 0 
              ? `Used ${searchResults.length} document(s) from your knowledge base to answer this question.`
              : 'No relevant documents found in knowledge base. Using general AI knowledge.',
          },
        },
      };

      // Log performance metrics
      this.logPerformanceMetrics(response);

      return response;
    } catch (error) {
      this.logger.error('Error processing message:', error);
      throw error;
    }
  }

  private buildContext(searchResults: any[], emotionAnalysis: any): string {
    if (searchResults.length === 0) {
      return '';
    }

    let context = 'Relevant information from knowledge base:\n\n';
    
    searchResults.forEach((result, index) => {
      context += `[Document ${index + 1}]\n`;
      context += `Title: ${result.title}\n`;
      context += `Content: ${result.content}\n`;
      context += `Relevance: ${(result.score * 100).toFixed(1)}%\n\n`;
    });

    // Add emotion context
    if (emotionAnalysis.primaryEmotion !== 'neutral') {
      context += `\nUser emotion detected: ${emotionAnalysis.primaryEmotion} (${emotionAnalysis.intensity} intensity)\n`;
      context += `Urgency level: ${emotionAnalysis.urgencyLevel}\n`;
    }

    // Trim to max length
    if (context.length > this.MAX_CONTEXT_LENGTH) {
      context = context.substring(0, this.MAX_CONTEXT_LENGTH) + '...';
    }

    return context;
  }

  private prepareMessages(currentMessage: string, history: any[]): any[] {
    const messages = [];

    // Add conversation history (last 5 messages)
    history.slice(-5).forEach(h => {
      messages.push({ role: 'user', content: h.userMessage });
      messages.push({ role: 'assistant', content: h.assistantMessage });
    });

    // Add current message
    messages.push({ role: 'user', content: currentMessage });

    return messages;
  }

  private buildSystemPrompt(emotionContext: string, metadata?: any): string {
    let prompt = `You are an AI consulting assistant. ${emotionContext}\n\n`;
    
    prompt += 'Guidelines:\n';
    prompt += '- Provide accurate information based on the provided context\n';
    prompt += '- Be concise but comprehensive\n';
    prompt += '- Use appropriate tone based on user emotion\n';
    prompt += '- Include relevant examples when helpful\n';
    prompt += '- Suggest related topics if appropriate\n';
    
    if (metadata?.language === 'vi') {
      prompt += '- Respond in Vietnamese\n';
    }
    
    return prompt;
  }

  private async formatResponse(content: string, searchResults: any[], emotionAnalysis: any): Promise<any> {
    const formatted: {
      content: string;
      media: Array<{ type: string; url?: string; caption?: string; content?: string }>;
    } = {
      content,
      media: [],
    };

    // Add media from search results if relevant
    searchResults.forEach(result => {
      if (result.media && result.score > 0.8) {
        formatted.media.push({
          type: result.media.type,
          url: result.media.url,
          caption: result.media.caption,
        });
      }
    });

    // Add emotion-specific media
    if (emotionAnalysis.primaryEmotion === 'confused' && formatted.media.length === 0) {
      // Add helpful diagrams or videos for confused users
      formatted.media.push({
        type: 'suggestion',
        content: 'Would you like me to provide a step-by-step guide?',
      });
    }

    return formatted;
  }

  private calculateResponseConfidence(searchResults: any[], emotionAnalysis: any): number {
    let confidence = 50; // Base confidence

    // Add confidence based on search results
    if (searchResults.length > 0) {
      const avgScore = searchResults.reduce((sum, r) => sum + r.score, 0) / searchResults.length;
      confidence += avgScore * 30;
    }

    // Add confidence based on emotion detection
    confidence += (emotionAnalysis.confidence / 100) * 20;

    return Math.min(Math.round(confidence), 95);
  }

  private async getConversationHistory(sessionId: string): Promise<any[]> {
    if (!sessionId) return [];
    
    try {
      return await this.databaseService.getConversationHistory(sessionId);
    } catch (error: any) {
      this.logger.error('Error fetching conversation history:', error.message || error);
      // Return empty array instead of throwing
      return [];
    }
  }

  private async saveConversation(data: any): Promise<void> {
    try {
      await this.databaseService.saveConversation(data);
    } catch (error: any) {
      this.logger.error('Error saving conversation:', error.message || error);
      // Don't throw, just log the error
    }
  }

  private async getCachedResponse(message: string): Promise<ChatResponse | null> {
    try {
      const cacheKey = this.generateCacheKey(message);
      return await this.cacheService.get(cacheKey);
    } catch (error) {
      this.logger.error('Cache error:', error);
      return null;
    }
  }

  private async cacheResponse(message: string, response: any): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(message);
      await this.cacheService.set(cacheKey, response, 3600); // 1 hour TTL
    } catch (error) {
      this.logger.error('Error caching response:', error);
    }
  }

  private generateCacheKey(message: string): string {
    // Simple normalization for cache key
    return `chat:${message.toLowerCase().trim().replace(/\s+/g, '_').substring(0, 100)}`;
  }

  private logPerformanceMetrics(response: ChatResponse): void {
    const metrics = {
      responseTime: response.processingTime,
      targetMet: response.processingTime <= this.TARGET_RESPONSE_TIME,
      confidence: response.confidence,
      cached: response.metadata?.cached || false,
    };

    this.logger.log(`Performance metrics: ${JSON.stringify(metrics)}`);

    if (!metrics.targetMet) {
      this.logger.warn(`Response time exceeded target: ${response.processingTime}ms > ${this.TARGET_RESPONSE_TIME}ms`);
    }
  }

  async createSession(userId: string): Promise<ChatSession> {
    const sessionId = uuidv4();
    const session: ChatSession = {
      id: sessionId,
      userId,
      startTime: new Date(),
      messages: [],
      metadata: {},
    };

    await this.databaseService.createSession(session);
    return session;
  }

  async endSession(sessionId: string): Promise<void> {
    await this.databaseService.endSession(sessionId);
  }
}