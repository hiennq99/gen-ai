import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BedrockService } from '../bedrock/bedrock.service';
import { EmotionService } from '../emotion/emotion.service';
import { SearchService } from '../search/search.service';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../cache/cache.service';
import { PersonalityService } from '../personality/personality.service';
import { MediaService } from '../media/media.service';
import type { ConversationContext } from '../personality/personality.service';
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
    private readonly personalityService: PersonalityService,
    private readonly mediaService: MediaService,
  ) {}

  private formatAnswerText(text: string): string {
    if (!text) return text;

    // Format bullet points exactly like admin CMS - keep ▪️ characters
    if (text.includes('▪️')) {
      const parts = text.split('▪️').filter(part => part.trim().length > 0);

      if (parts.length > 1) {
        let result = parts[0].trim();
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i].trim();
          const spacedPart = part.startsWith(' ') ? part : ' ' + part;
          result += '\n▪️' + spacedPart;
        }

        // Handle breathing patterns
        result = result
          .replace(/(\s+)(Inhale:)/g, '\n$2')
          .replace(/(\s+)(Exhale:)/g, '\n$2')
          .trim();

        return result;
      }
    }

    // Handle breathing patterns for non-bullet text
    return text
      .replace(/(\s+)(Inhale:)/g, '\n$2')
      .replace(/(\s+)(Exhale:)/g, '\n$2')
      .trim();
  }

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

      // Get conversation history early to check if it's first message
      const conversationHistory = await this.getConversationHistory(request.sessionId || '');
      
      // Search for relevant context - prioritize exact Q&A matches
      const searchResults = await this.searchService.searchDocuments({
        query: request.message,
        emotion: emotionAnalysis.primaryEmotion,
        limit: 5,
        minScore: 0.65, // Lowered to 65% to catch more relevant documents
        exactMatchFirst: true, // Prioritize exact Q&A matches
      });

      // Check if we have a high-relevance match (>65% relevance)
      const hasHighRelevanceMatch = searchResults.length > 0 && searchResults[0].score >= 0.65;
      
      // Check if we have an exact Q&A match (score >= 0.9 or type = qa_exact_match)
      const hasExactQAMatch = searchResults.length > 0 && 
                              (searchResults[0].score >= 0.9 || 
                               searchResults[0].metadata?.type === 'qa_exact_match');
      
      // Use document content if relevance is above 65%
      const exactMatchMode = hasHighRelevanceMatch || // Use document if relevance > 65%
                            hasExactQAMatch || // Automatically use exact mode for Q&A matches
                            request.metadata?.exactMatch || 
                            request.metadata?.mode === 'exact' ||
                            this.configService.get('chat.exactMatchMode', false);
      
      this.logger.log(`Mode: ${request.metadata?.mode}, Exact match: ${exactMatchMode}, Q&A match: ${hasExactQAMatch}, Best score: ${searchResults[0]?.score?.toFixed(2) || 'N/A'}, Search results: ${searchResults.length}`);
      
      if (exactMatchMode && searchResults.length > 0) {
        // Return the exact content from the best matching document
        const bestMatch = searchResults[0];
        const rawAnswer = bestMatch.content || bestMatch.text || 'No exact match found.';

        // Format the raw answer to handle bullet points properly
        const formattedAnswer = this.formatAnswerText(rawAnswer);

        // Check if this is the first message in the session
        const isFirstMessage = !conversationHistory || conversationHistory.length === 0;

        // Format response with empathetic header + formatted answer
        let formattedContent = '';

        // Generate empathetic header based on emotion
        const emotionalHeader = this.personalityService.generateEmpatheticHeader(
          emotionAnalysis.primaryEmotion,
          isFirstMessage,
          request.message
        );

        // Combine header with formatted answer
        formattedContent = `${emotionalHeader}\n\n${formattedAnswer}`;
        
        const matchType = hasExactQAMatch ? 'exact Q&A match (raw answer)' : 'exact document match';
        this.logger.log(`Returning ${matchType}`);
        
        // Generate emotion tags for response
        const emotionTags = this.emotionService.generateResponseEmotionTags(emotionAnalysis);

        // Generate emotion text summaries
        const emotionSummary = this.emotionService.getEmotionSummary(emotionAnalysis);
        const responseStyleText = this.emotionService.getResponseStyleText(emotionTags);

        // Generate dummy media based on emotion and content
        const dummyMedia = this.mediaService.generateDummyMedia(
          emotionAnalysis.primaryEmotion,
          request.message,
          true // Enable media generation
        );

        // Format as direct response
        const response: ChatResponse = {
          id: messageId,
          content: formattedContent,
          media: dummyMedia,
          emotion: emotionAnalysis.primaryEmotion,
          emotionTags,
          confidence: bestMatch.score ? bestMatch.score * 100 : 100,
          processingTime: Date.now() - startTime,
          metadata: {
            sessionId: request.sessionId,
            emotionAnalysis,
            emotionSummary,
            responseStyleText,
            documentsUsed: 1,
            documents: [{
              title: bestMatch.title || bestMatch.documentId || 'Document',
              relevanceScore: bestMatch.score ? (bestMatch.score * 100).toFixed(1) + '%' : '100%',
              excerpt: rawAnswer.substring(0, 200) + '...',
            }],
            cached: false,
            contextInfo: {
              totalDocuments: searchResults.length,
              contextUsed: true,
              message: hasExactQAMatch 
                ? `Exact Q&A answer from knowledge base`
                : `Exact match from document (no AI interpretation)`,
              qaMatch: hasExactQAMatch,
              matchedQuestion: bestMatch.metadata?.matchedQuestion,
              rawAnswer: hasExactQAMatch,
            },
            mode: hasExactQAMatch ? 'qa-exact-match' : 'exact-match',
          },
        };
        
        // Save conversation
        await this.saveConversation({
          messageId,
          sessionId: request.sessionId,
          userId: request.userId,
          userMessage: request.message,
          assistantMessage: formattedContent,
          emotion: emotionAnalysis,
          emotionTags,
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

      // Use the conversation history we already fetched
      const history = conversationHistory;

      // Build conversation context for personality
      const conversationContext = await this.buildConversationContext(
        request.userId || 'anonymous',
        request.sessionId,
        emotionAnalysis.primaryEmotion,
        history,
      );

      // Prepare messages for Claude
      const messages = this.prepareMessages(request.message, history);

      // Get emotion-based system prompt
      const emotionContext = this.emotionService.getEmotionContext(emotionAnalysis.primaryEmotion);
      const basePrompt = this.buildSystemPrompt(emotionContext, request.metadata);
      
      // Enhance with personality
      const systemPrompt = this.personalityService.getPersonalizedSystemPrompt(
        conversationContext,
        basePrompt,
      );

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

      // Generate dummy media for AI response
      const aiResponseMedia = this.mediaService.generateDummyMedia(
        emotionAnalysis.primaryEmotion,
        request.message,
        true // Enable media generation
      );

      // Format response with media
      const formattedResponse = {
        content: claudeResponse.content,
        media: aiResponseMedia
      };
      
      // Check if this is the first message in the session
      const isFirstMessage = !conversationHistory || conversationHistory.length === 0;
      
      // Generate empathetic header based on emotion
      const emotionalHeader = this.personalityService.generateEmpatheticHeader(
        emotionAnalysis.primaryEmotion,
        isFirstMessage,
        request.message
      );
      
      // Format as Header + Answer
      formattedResponse.content = `${emotionalHeader}\n\n${formattedResponse.content}`;

      // Generate emotion tags for AI response
      const emotionTags = this.emotionService.generateResponseEmotionTags(emotionAnalysis);

      // Generate emotion text summaries
      const emotionSummary = this.emotionService.getEmotionSummary(emotionAnalysis);
      const responseStyleText = this.emotionService.getResponseStyleText(emotionTags);

      // Save to database
      await this.saveConversation({
        messageId,
        sessionId: request.sessionId,
        userId: request.userId,
        userMessage: request.message,
        assistantMessage: formattedResponse.content,
        emotion: emotionAnalysis,
        emotionTags,
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
        emotionTags,
        confidence: this.calculateResponseConfidence(searchResults, emotionAnalysis),
        processingTime: Date.now() - startTime,
        metadata: {
          sessionId: request.sessionId,
          emotionAnalysis,
          emotionSummary,
          responseStyleText,
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
    let prompt = `You are a friendly, emotionally intelligent AI companion who genuinely cares about helping people. ${emotionContext}\n\n`;
    
    prompt += 'Core Guidelines:\n';
    prompt += '- Be a friend first, assistant second - show genuine care and empathy\n';
    prompt += '- Mix knowledge with emotional support and encouragement\n';
    prompt += '- Use conversational, warm language (avoid being too formal)\n';
    prompt += '- Remember: people come to you not just for information, but for connection\n';
    prompt += '- Acknowledge feelings before jumping to solutions\n';
    prompt += '- Share the journey with the user - celebrate wins, support through challenges\n';
    prompt += '- When using documentation, blend it naturally into friendly conversation\n';
    prompt += '- Ask thoughtful follow-up questions to show you care\n';
    prompt += '- Provide both practical help AND emotional support\n';
    
    if (metadata?.language === 'vi') {
      prompt += '- Respond in Vietnamese with the same warmth and friendliness\n';
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

  async handleEmotionSelection(params: {
    sessionId: string;
    userId: string;
    emotion: string;
  }): Promise<ChatResponse> {
    const { sessionId, userId, emotion } = params;
    const messageId = uuidv4();
    const startTime = Date.now();

    try {
      this.logger.log(`Handling emotion selection: ${emotion} for session ${sessionId}`);

      // Generate personalized greeting based on selected emotion
      const emotionalGreeting = this.personalityService.generateEmotionalGreeting(
        emotion as any,
        true
      );

      // Generate supportive content based on emotion
      let supportiveContent = '';
      
      switch (emotion) {
        case 'sad':
          supportiveContent = "Want to talk about it? Sometimes just having someone listen can make things feel a bit lighter. I'm here for as long as you need, no rush at all. We can chat about anything - what's weighing on your heart, or maybe something completely different to take your mind off things. Whatever feels right for you! 💙";
          break;
        case 'happy':
          supportiveContent = "This is so awesome! I want to hear ALL about what's making you so happy! Is it something that happened today? Something you achieved? Someone special? Spill the tea - let's celebrate together! 🎊 Your joy is totally making my day!";
          break;
        case 'angry':
          supportiveContent = "Tell me what's got you so fired up! Sometimes we just need to let it all out, you know? I'm here to listen to every single frustration - big or small. No judgment, just support. And hey, if you want to problem-solve later, I'm here for that too. But right now? Let's just acknowledge that anger! 💪";
          break;
        case 'confused':
          supportiveContent = "Okay, let's tackle this confusion together! What's got your brain doing loops? I promise we'll break it down into bite-sized pieces that actually make sense. No rush, no pressure - we've got all the time in the world to figure this out! 🧩";
          break;
        case 'fear':
        case 'anxious':
          supportiveContent = "Breathe with me for a sec... in... and out... 🌸 Anxiety can feel so overwhelming, I know! But guess what? We're going to face this together. Tell me what's making you anxious - sometimes just naming it takes away some of its power. And remember, I'm right here with you through all of it!";
          break;
        case 'grateful':
          supportiveContent = "This is beautiful! A grateful heart is such a gift! 💝 Tell me what's filling you with gratitude today - I love hearing about the good stuff! Whether it's something big or just a tiny moment that made you smile, I want to celebrate it with you!";
          break;
        case 'urgent':
          supportiveContent = "Alright, I'm in emergency mode! 🚨 Tell me exactly what's happening and what you need - I'm ready to jump into action! We'll handle this step by step, and I'll stay with you until everything's sorted. What's the most pressing thing right now?";
          break;
        case 'neutral':
          supportiveContent = "So what's up? What brings you here today? Whether you want to chat, need help with something specific, or just want to hang out - I'm all yours! How's your day been treating you? 😊";
          break;
        default:
          supportiveContent = "Hey there! I'm so glad you're here! Whether you need a friend, some help, or just want to chat - I'm all in! What's on your mind today? Let's make this conversation exactly what you need it to be! 🌟";
      }

      const fullResponse = emotionalGreeting + supportiveContent;

      // Save this as the first interaction
      await this.saveConversation({
        messageId,
        sessionId,
        userId,
        userMessage: `[Emotion Selected: ${emotion}]`,
        assistantMessage: fullResponse,
        emotion: { primaryEmotion: emotion, confidence: 100 },
        processingTime: Date.now() - startTime,
        metadata: {
          type: 'emotion-selection',
          selectedEmotion: emotion,
        },
      });

      const response: ChatResponse = {
        id: messageId,
        content: fullResponse,
        media: [],
        emotion: emotion as any,
        confidence: 100,
        processingTime: Date.now() - startTime,
        metadata: {
          sessionId,
          type: 'emotion-greeting',
          selectedEmotion: emotion,
          emotionAnalysis: {
            primaryEmotion: emotion,
            confidence: 100,
            intensity: 'selected',
            urgencyLevel: emotion === 'urgent' ? 'high' : 'medium',
          },
        },
      };

      return response;
    } catch (error) {
      this.logger.error('Error handling emotion selection:', error);
      throw error;
    }
  }

  private async buildConversationContext(
    userId: string,
    sessionId: string | undefined,
    userMood: any,
    history: any[],
  ): Promise<ConversationContext> {
    // Extract user information and preferences from history
    const previousTopics = history
      .map(h => h.userMessage)
      .slice(-10)
      .map(msg => this.extractTopic(msg));
    
    const sharedExperiences = history
      .filter(h => h.metadata?.memorable)
      .map(h => h.metadata.experience || h.userMessage.substring(0, 50));
    
    // Calculate relationship depth based on interaction history
    const relationshipDepth = Math.min(100, history.length * 5 + 20);
    
    // Get user profile if available
    const userProfile = await this.getUserProfile(userId);
    
    return {
      userName: userProfile?.name,
      previousTopics,
      userPreferences: userProfile?.preferences || {},
      relationshipDepth,
      lastInteraction: history.length > 0 ? new Date(history[history.length - 1].timestamp) : undefined,
      userMood,
      sharedExperiences,
    };
  }

  private extractTopic(message: string): string {
    // Simple topic extraction - can be enhanced with NLP
    const keywords = message
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 4)
      .slice(0, 3)
      .join(' ');
    return keywords || 'general conversation';
  }

  private async getUserProfile(userId: string): Promise<any> {
    try {
      // Try to get user profile from database
      return await this.databaseService.getUserProfile(userId);
    } catch (error) {
      this.logger.debug('User profile not found, using defaults');
      return null;
    }
  }
}