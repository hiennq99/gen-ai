import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BedrockService } from '../bedrock/bedrock.service';
import { EmotionService } from '../emotion/emotion.service';
import { SearchService } from '../search/search.service';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../cache/cache.service';
import { PersonalityService } from '../personality/personality.service';
import { MediaService } from '../media/media.service';
import { SpiritualGuidanceService } from '../spiritual-guidance/spiritual-guidance.service';
import { RecommendationService } from '../recommendations/recommendation.service';
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
    private readonly spiritualGuidanceService: SpiritualGuidanceService,
    private readonly recommendationService: RecommendationService,
  ) {}

  /**
   * Clean evidence text from PDF extraction artifacts
   */
  private cleanEvidenceText(text: string): string {
    if (!text) return text;

    return text
      // Fix broken words with newlines in the middle: "s\nays" -> "says" (only single letters)
      .replace(/\b([a-z])\s*\n\s*([a-z]{2,})/g, '$1$2')
      // Fix broken words with newlines: "F\norgetfulness" -> "Forgetfulness"
      .replace(/([A-Z])\s*\n\s*([a-z])/g, '$1$2')
      // Fix broken 2-letter words with spaces: "Th e" -> "The"
      .replace(/\b([A-Z][a-z])\s+([a-z])\b/g, '$1$2')
      // Fix broken words with spaces at word boundaries: "Y our" -> "Your"
      .replace(/\b([A-Z])\s+([a-z]{2,})/g, '$1$2')
      // Fix broken Quranic references like "[A\nl-Baqarah" -> "[Al-Baqarah"
      .replace(/\[A\s*\n?\s*l-/g, '[Al-')
      // Preserve bullet points and list markers (o, •, -, *)
      .replace(/\n([o•\-*])\s/g, '\n\n$1 ')
      // Remove single newlines (join paragraphs) but keep bullet points
      .replace(/([^\n])\n(?![o•\-*\n])([^\n])/g, '$1 $2')
      // Add proper line breaks after quotes with references
      .replace(/("\s*\[[^\]]+\])/g, '$1\n\n')
      // Add line break before new evidence sections
      .replace(/(Allāh\s+says?:)/gi, '\n\n$1')
      .replace(/(The\s+Prophet\s+said:)/gi, '\n\n$1')
      .replace(/(Imām\s+[^:]+said:)/gi, '\n\n$1')
      // Normalize multiple newlines to double newline (paragraph breaks)
      .replace(/\n{3,}/g, '\n\n')
      // Normalize multiple spaces
      .replace(/\s{2,}/g, ' ')
      // Remove page numbers
      .replace(/\[p\.\s*\d+\]/g, '')
      .trim();
  }

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
      // Ensure we have a session ID for proper conversation tracking
      const sessionId = request.sessionId || uuidv4();
      request.sessionId = sessionId;

      this.logger.log(`Processing message for session: ${sessionId}, hasSessionId: ${!!request.sessionId}`);

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
      const conversationHistory = await this.getConversationHistory(sessionId);

      // Check for duplicate responses in this conversation
      const isDuplicateResponse = await this.checkForDuplicateResponse(request.message, conversationHistory);
      if (isDuplicateResponse) {
        this.logger.log('🔄 Duplicate response detected, generating alternative response');
      }
      
      // Search for relevant context - prioritize exact Q&A matches
      const searchResults = await this.searchService.searchDocuments({
        query: request.message,
        emotion: emotionAnalysis.primaryEmotion,
        limit: 5,
        minScore: 0.1, // LOWERED to 10% to always find the best available match
        exactMatchFirst: true, // Prioritize exact Q&A matches
      });

      // Check if we have a high-relevance match (>50% relevance) - LOWERED THRESHOLD FOR BETTER MATCHING
      // const hasHighRelevanceMatch = searchResults.length > 0 && searchResults[0].score >= 0.5;

      // Check if we have a Q&A match (score >= 0.5 for 50%+ similarity)
      const hasExactQAMatch = searchResults.length > 0 &&
                              (searchResults[0].score >= 0.5 ||
                               searchResults[0].metadata?.type === 'qa_exact_match' ||
                               searchResults[0].metadata?.type === 'qa_semantic_high' ||
                               searchResults[0].metadata?.type === 'qa_semantic_medium' ||
                               searchResults[0].metadata?.type === 'qa_semantic_match');

      // Determine response mode based on message count and document confidence
      const bestDocument = searchResults.length > 0 ? searchResults[0] : null;
      const documentScore = bestDocument?.score || 0;
      const isFirstMessage = !conversationHistory || conversationHistory.length === 0;

      // Calculate confidence percentage for the best document
      let documentConfidence = 0;
      if (bestDocument) {
        if (bestDocument.score < 1) {
          documentConfidence = bestDocument.score * 50; // 0-1 → 0-50%
        } else if (bestDocument.score < 5) {
          documentConfidence = 50 + ((bestDocument.score - 1) / 4) * 30; // 1-5 → 50-80%
        } else if (bestDocument.score < 10) {
          documentConfidence = 80 + ((bestDocument.score - 5) / 5) * 15; // 5-10 → 80-95%
        } else {
          documentConfidence = 95 + Math.min((bestDocument.score - 10) / 10, 1) * 5; // 10-20 → 95-100%
        }
      }

      // Decision logic:
      // - Always require ≥80% confidence to use document (for both first and subsequent messages)
      // - If duplicate detected: force AI interpretation for variety
      // - Otherwise use AI interpretation with conversation context
      const useDocumentMode = bestDocument !== null && documentConfidence >= 80 && !isDuplicateResponse;

      this.logger.log(`📊 Mode Decision: isFirstMessage=${isFirstMessage}, documentScore=${documentScore.toFixed(3)}, confidence=${documentConfidence.toFixed(1)}%, useDocument=${useDocumentMode} (requires ≥80%), isDuplicate=${isDuplicateResponse}`);

      if (useDocumentMode) {
        // Return the exact content from the best matching training document
        const bestMatch = searchResults[0];

        // Check the type of match
        const isEvidenceBased = bestMatch.metadata?.type === 'evidence';
        const isQAMatch = bestMatch.metadata?.type === 'qa_exact_match' ||
                          bestMatch.metadata?.type === 'qa_semantic_match' ||
                          bestMatch.metadata?.type === 'qa_semantic_high' ||
                          bestMatch.metadata?.type === 'qa_semantic_medium';

        // Get the answer based on type
        let rawAnswer: string;

        if (isQAMatch) {
          // For Q&A pairs from CSV, get the answer from metadata
          rawAnswer = bestMatch.metadata?.answer || bestMatch.content || bestMatch.text || 'No answer found.';
          this.logger.log(`📝 Using Q&A answer from CSV training data`);
        } else if (isEvidenceBased) {
          // For evidence chunks, use evidenceText
          rawAnswer = bestMatch.metadata?.evidenceText || bestMatch.content || bestMatch.text || 'No evidence found.';
          this.logger.log(`📖 Using evidence text from PDF`);
        } else {
          // For other documents, use content/text
          rawAnswer = bestMatch.content || bestMatch.text || 'No exact match found.';
          this.logger.log(`📄 Using document content`);
        }

        // Clean evidence text if it's evidence-based (fix PDF extraction artifacts)
        if (isEvidenceBased) {
          rawAnswer = this.cleanEvidenceText(rawAnswer);
        }

        // Format the raw answer to handle bullet points properly
        const formattedAnswer = this.formatAnswerText(rawAnswer);

        // Generate empathetic header based on emotion
        const emotionalHeader = this.personalityService.generateEmpatheticHeader(
          emotionAnalysis.primaryEmotion,
          isFirstMessage,
          request.message
        );

        // Combine header with formatted answer
        let formattedContent = `${emotionalHeader}\n\n${formattedAnswer}`;

        // Add source citation to the content (this will be set after sourceDisplay is determined)
        let finalFormattedContent = formattedContent;

        // Use the confidence calculated earlier
        const confidencePercent = documentConfidence;

        const isHighConfidence = bestMatch.metadata?.isHighConfidenceMatch || bestMatch.score >= 5.0;
        const matchQuality = bestMatch.metadata?.qualityTier || 'standard';
        const matchType = isHighConfidence ?
          `HIGH CONFIDENCE MATCH (score: ${bestMatch.score.toFixed(2)}, confidence: ${confidencePercent.toFixed(1)}%)` :
          hasExactQAMatch ? 'exact Q&A match (raw answer)' : 'exact document match';

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

        // Prepare source information based on match type
        let sourceInfo: any = {};
        let sourceDisplay = '';

        if (isQAMatch) {
          // Q&A from CSV training
          const matchedQ = bestMatch.metadata?.question || bestMatch.content;
          sourceInfo = {
            type: 'qa_training',
            source: 'CSV Upload',
            sourceQuestion: matchedQ,
            matchedQuestion: matchedQ,
            originalAnswer: bestMatch.metadata?.answer,
            jobId: bestMatch.metadata?.jobId,
            uploadedAt: bestMatch.metadata?.uploadedAt,
          };
          // Create readable source display
          sourceDisplay = `📚 Source: Training Data\n💬 Question: "${matchedQ}"`;
          this.logger.log(`📝 Q&A Match - Source Question: ${matchedQ.substring(0, 80)}...`);
        } else if (isEvidenceBased) {
          // Evidence from PDF
          sourceInfo = {
            type: 'evidence',
            source: 'PDF Document',
            disease: bestMatch.metadata?.disease,
            sourceFile: bestMatch.metadata?.sourceFile,
            chunkIndex: bestMatch.metadata?.chunkIndex,
            evidenceCount: bestMatch.metadata?.evidenceCount,
          };
          // Enhanced evidence citation with page information
          const documentName = bestMatch.metadata?.sourceFile || 'PDF Document';
          const pageNum = bestMatch.metadata?.pageNumber;
          const disease = bestMatch.metadata?.disease || 'Spiritual Medicine';

          sourceDisplay = `📄 **Source:** ${documentName}`;
          if (pageNum) {
            sourceDisplay += `\n📑 **Page:** ${pageNum}`;
          }
          sourceDisplay += `\n🏥 **Topic:** ${disease}`;
        } else {
          // PDF or other document types with page information
          const documentName = bestMatch.metadata?.documentName || bestMatch.title || 'Document';
          const pageNum = bestMatch.metadata?.page;
          const totalPages = bestMatch.metadata?.totalPages;

          sourceInfo = {
            type: 'document',
            source: 'Document',
            documentId: bestMatch.documentId,
            title: bestMatch.title,
            documentName,
            page: pageNum,
            totalPages: totalPages,
            documentType: bestMatch.metadata?.documentType,
          };

          sourceDisplay = `📄 **Source:** ${documentName}`;
          if (pageNum) {
            sourceDisplay += `\n📑 **Page:** ${pageNum}`;
            if (totalPages) {
              sourceDisplay += ` of ${totalPages}`;
            }
          }
          if (bestMatch.metadata?.documentType) {
            sourceDisplay += `\n📋 **Type:** ${bestMatch.metadata.documentType.toUpperCase()}`;
          }
        }

        // Append citation to the content
        finalFormattedContent = `${formattedContent}\n\n---\n\n${sourceDisplay}`;

        // Format as direct response
        const response: ChatResponse = {
          id: messageId,
          content: finalFormattedContent,
          media: dummyMedia,
          emotion: emotionAnalysis.primaryEmotion,
          emotionTags,
          confidence: confidencePercent,
          processingTime: Date.now() - startTime,
          metadata: {
            sessionId: request.sessionId,
            emotionAnalysis,
            emotionSummary,
            responseStyleText,
            documentsUsed: 1,
            documents: [{
              title: isQAMatch
                ? (bestMatch.metadata?.question?.substring(0, 80) + '...' || 'Training Q&A')
                : (bestMatch.metadata?.documentName || bestMatch.title || bestMatch.metadata?.disease || 'Document'),
              relevanceScore: confidencePercent.toFixed(1) + '%',
              excerpt: rawAnswer.substring(0, 200) + (rawAnswer.length > 200 ? '...' : ''),
              matchType: bestMatch.metadata?.type || 'document_match',
              source: sourceInfo.source,
              page: bestMatch.metadata?.page,
              totalPages: bestMatch.metadata?.totalPages,
              documentType: bestMatch.metadata?.documentType,
              documentName: bestMatch.metadata?.documentName,
              ...sourceInfo,
            }],
            source: sourceInfo,
            sourceDisplay: sourceDisplay,
            cached: false,
            contextInfo: {
              totalDocuments: searchResults.length,
              contextUsed: true,
              message: this.getMatchTypeMessage(bestMatch),
              qaMatch: isQAMatch,
              evidenceMatch: isEvidenceBased,
              matchedQuestion: isQAMatch ? bestMatch.metadata?.question : null,
              matchedDisease: isEvidenceBased ? bestMatch.metadata?.disease : null,
              rawAnswer: isQAMatch || isEvidenceBased,
              semanticMatch: bestMatch.metadata?.semanticMatch || false,
              matchScore: confidencePercent.toFixed(1) + '%',
              confidenceLevel: confidencePercent >= 95 ? 'high' : confidencePercent >= 80 ? 'medium' : 'low',
              matchType: bestMatch.metadata?.type || 'standard',
              qualityTier: bestMatch.metadata?.qualityTier || 'standard',
              isHighConfidence: isHighConfidence,
              matchQuality: matchQuality,
            },
            mode: isQAMatch ? 'qa-match' : (isEvidenceBased ? 'evidence-match' : 'document-match'),
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
            media: dummyMedia, // Include media in metadata
          },
        });

        // Get recommendations based on query and emotion
        const recommendations = await this.recommendationService.getRecommendations({
          query: request.message,
          emotion: emotionAnalysis.primaryEmotion,
          keywords: emotionAnalysis.keywords,
          limit: 5,
        });

        // Add recommendations to metadata
        if (recommendations.length > 0) {
          response.metadata.recommendations = recommendations;
        }

        return response;
      }

      // AI INTERPRETATION MODE: No documents OR low confidence on 2nd+ message - use AI with conversation context
      // This path handles both: (1) no documents found, (2) 2nd+ message with <95% confidence
      this.logger.log(`Using AI interpretation mode: hasDocuments=${searchResults.length > 0}, confidence=${documentConfidence.toFixed(1)}%, isFirstMessage=${isFirstMessage}`);

      // Build conversation context from history for AI
      const conversationContext = conversationHistory.slice(-5).map((msg: any) => {
          if (msg.userMessage) {
            return `User: ${msg.userMessage}`;
          } else if (msg.assistantMessage) {
            return `Assistant: ${msg.assistantMessage}`;
          }
          return '';
        }).filter(Boolean).join('\n');

        // Create context-aware prompt for AI
        const duplicateInstruction = isDuplicateResponse
          ? '\n\nIMPORTANT: The user has asked a similar question before. Provide a fresh perspective, different examples, or explore a new angle. Avoid repeating previous responses.'
          : '';

        const contextualPrompt = conversationContext
          ? `You are a helpful, empathetic AI assistant specialized in spiritual guidance and mental wellness. Respond naturally and conversationally.${duplicateInstruction}\n\nPrevious conversation:\n${conversationContext}\n\nUser's current question: ${request.message}\n\nProvide a helpful, warm, and supportive response:`
          : `You are a helpful, empathetic AI assistant specialized in spiritual guidance and mental wellness. Respond naturally and conversationally.${duplicateInstruction}\n\nUser question: ${request.message}\n\nProvide a helpful, warm, and supportive response:`;

        // Generate AI response using Bedrock
        const aiGeneratedResponse = await this.bedrockService.invokeModel({
          messages: [{ role: 'user', content: contextualPrompt }],
          maxTokens: 300,
          temperature: 0.7
        });

        // Add empathetic header to AI response
        const emotionalHeader = this.personalityService.generateEmpatheticHeader(
          emotionAnalysis.primaryEmotion,
          conversationHistory.length === 0,
          request.message
        );

        const aiResponse = `${emotionalHeader}\n\n${aiGeneratedResponse.content || 'I\'m here to support you. How can I help you further?'}`;

        const emotionTags = this.emotionService.generateResponseEmotionTags(emotionAnalysis);
        const emotionSummary = this.emotionService.getEmotionSummary(emotionAnalysis);
        const responseStyleText = this.emotionService.getResponseStyleText(emotionTags);

        const dummyMedia = this.mediaService.generateDummyMedia(
          emotionAnalysis.primaryEmotion,
          request.message,
          true
        );

        const response: ChatResponse = {
          id: messageId,
          content: aiResponse,
          media: dummyMedia,
          emotion: emotionAnalysis.primaryEmotion,
          emotionTags,
          confidence: 70,
          processingTime: Date.now() - startTime,
          metadata: {
            sessionId: request.sessionId,
            emotionAnalysis,
            emotionSummary,
            responseStyleText,
            documentsUsed: 0,
            documents: [],
            cached: false,
            contextInfo: {
              totalDocuments: 0,
              contextUsed: true,
              message: 'AI interpretation mode: No documents found, using conversation context and AI knowledge',
              firstMessage: conversationHistory.length === 0,
            },
            mode: 'ai-interpretation',
          },
        };

        await this.saveConversation({
          messageId,
          sessionId: request.sessionId,
          userId: request.userId,
          userMessage: request.message,
          assistantMessage: response.content,
          emotion: emotionAnalysis,
          emotionTags,
          processingTime: Date.now() - startTime,
          metadata: {
            mode: 'ai-interpretation',
            media: dummyMedia,
          },
        });

        // Get recommendations for AI interpretation mode
        const recommendations = await this.recommendationService.getRecommendations({
          query: request.message,
          emotion: emotionAnalysis.primaryEmotion,
          keywords: emotionAnalysis.keywords,
          limit: 5,
        });

        if (recommendations.length > 0) {
          response.metadata.recommendations = recommendations;
        }

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

  /**
   * Check if we've already provided a similar response in this conversation
   */
  private async checkForDuplicateResponse(currentMessage: string, conversationHistory: any[]): Promise<boolean> {
    if (!conversationHistory || conversationHistory.length === 0) {
      return false;
    }

    // Get recent assistant messages from the last 10 exchanges
    const recentResponses = conversationHistory
      .slice(-20) // Last 20 messages (10 exchanges)
      .filter(msg => msg.assistantMessage)
      .map(msg => msg.assistantMessage);

    if (recentResponses.length === 0) {
      return false;
    }

    // Check if current message is very similar to recent user messages
    const recentUserMessages = conversationHistory
      .slice(-10) // Last 10 messages
      .filter(msg => msg.userMessage)
      .map(msg => msg.userMessage);

    for (const previousMessage of recentUserMessages) {
      if (this.areSimilarMessages(currentMessage, previousMessage)) {
        this.logger.log(`🔍 Similar message detected: "${currentMessage.substring(0, 50)}..." vs "${previousMessage.substring(0, 50)}..."`);
        return true;
      }
    }

    return false;
  }

  /**
   * Check if two messages are similar enough to be considered duplicates
   */
  private areSimilarMessages(message1: string, message2: string): boolean {
    if (!message1 || !message2) return false;

    // Normalize messages for comparison
    const normalize = (text: string) =>
      text.toLowerCase()
          .replace(/[^\w\s]/g, '') // Remove punctuation
          .replace(/\s+/g, ' ')    // Normalize whitespace
          .trim();

    const normalized1 = normalize(message1);
    const normalized2 = normalize(message2);

    // Exact match after normalization
    if (normalized1 === normalized2) {
      return true;
    }

    // Check if one message contains the other (for longer vs shorter versions)
    if (normalized1.length > 20 && normalized2.length > 20) {
      const shorter = normalized1.length < normalized2.length ? normalized1 : normalized2;
      const longer = normalized1.length >= normalized2.length ? normalized1 : normalized2;

      if (longer.includes(shorter) && shorter.length / longer.length > 0.8) {
        return true;
      }
    }

    // Calculate similarity ratio for substantial messages
    if (normalized1.length > 30 && normalized2.length > 30) {
      const similarity = this.calculateSimilarity(normalized1, normalized2);
      return similarity > 0.85; // 85% similarity threshold
    }

    return false;
  }

  /**
   * Calculate text similarity using simple word overlap
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(' ').filter(w => w.length > 3));
    const words2 = new Set(text2.split(' ').filter(w => w.length > 3));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
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

  private getMatchTypeMessage(bestMatch: any): string {
    const matchType = bestMatch.metadata?.type;
    const score = bestMatch.score ? (bestMatch.score * 100).toFixed(1) + '%' : '100%';

    switch (matchType) {
      case 'qa_exact_match':
        return `Found exact match in training data (${score} similarity)`;
      case 'qa_semantic_high':
        return `Found high semantic similarity with training question: "${bestMatch.metadata?.matchedQuestion}" (${score} similarity)`;
      case 'qa_semantic_medium':
        return `Found medium semantic similarity with training question: "${bestMatch.metadata?.matchedQuestion}" (${score} similarity)`;
      case 'qa_semantic_match':
        return `Found similar meaning to training question: "${bestMatch.metadata?.matchedQuestion}" (${score} similarity)`;
      case 'qa_low_match':
        return `Found low but relevant match to training question: "${bestMatch.metadata?.matchedQuestion}" (${score} similarity)`;
      case 'qa_best_available':
        return `Best available match from training data: "${bestMatch.metadata?.matchedQuestion}" (${score} relevance)`;
      default:
        return `Matched training document with ${score} relevance - best available`;
    }
  }

  private getAIResponseContextMessage(searchResults: any[]): string {
    if (searchResults.length === 0) {
      return 'No relevant documents found in knowledge base. Using general AI knowledge.';
    }

    const highConfidence = searchResults.filter(r => r.score >= 0.75).length;
    const mediumConfidence = searchResults.filter(r => r.score >= 0.5 && r.score < 0.75).length;
    const lowConfidence = searchResults.filter(r => r.score >= 0.3 && r.score < 0.5).length;
    const semanticMatches = searchResults.filter(r => r.metadata?.semanticMatch).length;

    let message = '';

    if (highConfidence > 0) {
      message = `AI response enhanced with ${highConfidence} high-confidence training document(s)`;
    } else if (mediumConfidence > 0) {
      message = `AI response enhanced with ${mediumConfidence} medium-confidence training document(s)`;
    } else if (lowConfidence > 0) {
      message = `AI response enhanced with ${lowConfidence} lower-confidence but relevant training document(s)`;
    } else {
      message = `AI response enhanced with ${searchResults.length} training document(s)`;
    }

    if (semanticMatches > 0) {
      message += ` (${semanticMatches} semantic match${semanticMatches > 1 ? 'es' : ''})`;
    }

    return message + '. Document references visible in metadata.';
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

  async processSpiritualGuidanceMessage(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    const messageId = uuidv4();

    try {
      this.logger.log('Processing spiritual guidance message');

      // Get conversation history for context
      const conversationHistory = await this.getConversationHistory(request.sessionId || '');
      const historyMessages = conversationHistory?.map(h => h.userMessage) || [];

      // Create spiritual guidance request
      const guidanceRequest = {
        message: request.message,
        conversationHistory: historyMessages.slice(-5), // Last 5 messages for context
      };

      // Get spiritual guidance response
      const guidanceResponse = await this.spiritualGuidanceService.provideSpiritualGuidance(guidanceRequest);

      // Create enhanced response with citations
      let responseContent = guidanceResponse.response;

      // Add citation information if available
      if (guidanceResponse.citations.length > 0) {
        responseContent += '\n\n📚 **References from A Handbook of Spiritual Medicine:**\n';

        guidanceResponse.citations.forEach((citation, _index) => {
          responseContent += `• Page ${citation.page}: "${citation.quote}"\n`;
        });

        if (guidanceResponse.spiritualDisease) {
          responseContent += `\n🔍 **Related Topic:** ${guidanceResponse.spiritualDisease.name} (${guidanceResponse.spiritualDisease.arabicName})\n`;
          responseContent += `📖 **Chapter:** Pages ${guidanceResponse.spiritualDisease.pageRange}`;
        }
      }

      // Determine emotion based on spiritual guidance analysis
      const emotion = guidanceResponse.spiritualDisease?.name.toLowerCase() || 'spiritual-guidance';

      // Generate media suggestions based on spiritual context
      const media = await this.generateSpiritualMedia(
        guidanceResponse.spiritualDisease?.name || 'general',
        guidanceResponse.citationLevel
      );

      const response: ChatResponse = {
        id: messageId,
        content: responseContent,
        media,
        emotion: emotion as any,
        confidence: this.mapCitationLevelToConfidence(guidanceResponse.citationLevel),
        processingTime: Date.now() - startTime,
        metadata: {
          sessionId: request.sessionId,
          type: 'spiritual-guidance',
          citationLevel: guidanceResponse.citationLevel,
          spiritualDisease: guidanceResponse.spiritualDisease?.name,
          citationCount: guidanceResponse.citations.length,
          templateUsed: guidanceResponse.templateUsed,
          spiritualGuidance: true,
          emotionAnalysis: {
            primaryEmotion: emotion,
            confidence: this.mapCitationLevelToConfidence(guidanceResponse.citationLevel),
            spiritualContext: true,
          },
        },
      };

      // Save conversation with spiritual guidance metadata
      await this.saveConversation({
        messageId,
        sessionId: request.sessionId!,
        userId: request.userId!,
        userMessage: request.message,
        assistantMessage: responseContent,
        emotion: { primaryEmotion: emotion, confidence: response.confidence },
        processingTime: Date.now() - startTime,
        metadata: {
          type: 'spiritual-guidance',
          citationLevel: guidanceResponse.citationLevel,
          spiritualDisease: guidanceResponse.spiritualDisease?.name,
          citations: guidanceResponse.citations.map(c => ({ page: c.page, context: c.context })),
        },
      });

      this.logger.log('Spiritual guidance response generated', {
        citationLevel: guidanceResponse.citationLevel,
        citationCount: guidanceResponse.citations.length,
        processingTime: Date.now() - startTime,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to process spiritual guidance message', error);

      // Fallback to regular processing
      return this.processMessage(request);
    }
  }

  private async generateSpiritualMedia(spiritualDisease: string, _citationLevel: string): Promise<any[]> {
    try {
      const mediaItems = [];

      // Generate appropriate media based on spiritual disease
      const mediaMap: Record<string, any[]> = {
        'anger': [
          { type: 'image', description: 'Calming nature scene for anger management', mood: 'peaceful' },
          { type: 'audio', description: 'Dhikr for controlling anger', category: 'spiritual' }
        ],
        'envy': [
          { type: 'image', description: 'Gratitude and contentment imagery', mood: 'grateful' },
          { type: 'video', description: 'Teaching about being content with Allah\'s decree', category: 'educational' }
        ],
        'hard-heartedness': [
          { type: 'image', description: 'Heart purification imagery', mood: 'reflective' },
          { type: 'audio', description: 'Quran recitation for softening the heart', category: 'spiritual' }
        ],
        'general': [
          { type: 'image', description: 'Islamic spiritual guidance imagery', mood: 'peaceful' }
        ]
      };

      const diseaseMedia = mediaMap[spiritualDisease.toLowerCase()] || mediaMap['general'];

      for (const mediaItem of diseaseMedia) {
        const generatedMedia = await this.mediaService.generateDummyMedia(
          mediaItem.mood || 'neutral' as any,
          mediaItem.description || 'spiritual guidance request',
          true
        );

        if (generatedMedia) {
          mediaItems.push(generatedMedia);
        }
      }

      return mediaItems.slice(0, 2); // Limit to 2 media items
    } catch (error) {
      this.logger.warn('Failed to generate spiritual media', error);
      return [];
    }
  }

  private mapCitationLevelToConfidence(citationLevel: string): number {
    switch (citationLevel) {
      case 'perfect_match': return 95;
      case 'related_theme': return 80;
      case 'general_guidance': return 65;
      case 'no_direct_match': return 40;
      default: return 50;
    }
  }
}