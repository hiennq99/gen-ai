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
      // Preserve bullet points and list markers (o, •, -, *, ▪)
      .replace(/\n([o•\-*▪])\s/g, '\n\n$1 ')
      // PRESERVE ALL line breaks - DO NOT join any lines
      // PDF formatting is intentional, keep it as-is
      // Add proper line breaks after quotes with references
      .replace(/("\s*\[[^\]]+\])/g, '$1\n\n')
      // Add line break before new evidence sections
      .replace(/(Allāh\s+says?:)/gi, '\n\n$1')
      .replace(/(The\s+Prophet\s+said:)/gi, '\n\n$1')
      .replace(/(Imām\s+[^:]+said:)/gi, '\n\n$1')
      // Normalize multiple newlines to double newline (paragraph breaks)
      .replace(/\n{3,}/g, '\n\n')
      // Normalize multiple spaces (but NOT newlines)
      .replace(/[ \t]{2,}/g, ' ')
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

      // TIER 1: Vector Database with relevance ≥ 95%
      // - Return exact answer without modification + cite source
      const useTier1VectorDB = bestDocument !== null && documentConfidence >= 95;

      // TIER 2: PDF Training Data (if no Tier 1 match)
      // - Use AI to search knowledge from trained PDFs + cite source
      // - Only trigger if no high-confidence vector match

      // TIER 3: AI Knowledge + Conversation Context (fallback)
      // - Use Claude's general knowledge + conversation history

      this.logger.log(`📊 Decision Logic: isFirstMessage=${isFirstMessage}, documentScore=${documentScore.toFixed(3)}, confidence=${documentConfidence.toFixed(1)}%`);
      this.logger.log(`📊 TIER 1 (Vector DB ≥95%): ${useTier1VectorDB ? 'YES ✓' : 'NO'}`);

      if (useTier1VectorDB) {
        // ===== TIER 1: EXACT VECTOR DATABASE MATCH (≥95% confidence) =====
        // Return exact answer without modification + cite source
        this.logger.log(`🎯 TIER 1 ACTIVATED: Using Vector DB exact match (${documentConfidence.toFixed(1)}% confidence)`);

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
        const formattedContent = `${emotionalHeader}\n\n${formattedAnswer}`;

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
            chapterNumber: bestMatch.metadata?.chapterNumber,
            chapterName: bestMatch.metadata?.chapterName,
          };

          // Build citation with chapter information
          const fileName = bestMatch.metadata?.sourceFile || 'PDF Document';
          const chapterNum = bestMatch.metadata?.chapterNumber;
          const chapterName = bestMatch.metadata?.chapterName || bestMatch.metadata?.disease;

          if (chapterNum && chapterName) {
            sourceDisplay = `📖 Source: ${fileName}\n📑 Chapter ${chapterNum}: ${chapterName}`;
          } else {
            sourceDisplay = `📖 Source: ${fileName}\n🏥 Topic: ${chapterName || 'Spiritual Medicine'}`;
          }
        } else {
          // Other document types
          sourceInfo = {
            type: 'document',
            source: 'Document',
            documentId: bestMatch.documentId,
            title: bestMatch.title,
          };
          sourceDisplay = `📄 Source: ${bestMatch.title || 'Document'}`;
        }

        // Append citation to content for user display
        const contentWithCitation = `${formattedContent}\n\n${sourceDisplay}`;

        // Format as direct response
        const response: ChatResponse = {
          id: messageId,
          content: contentWithCitation,
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
                : (bestMatch.title || bestMatch.metadata?.disease || 'Training Document'),
              relevanceScore: confidencePercent.toFixed(1) + '%',
              excerpt: rawAnswer.substring(0, 200) + (rawAnswer.length > 200 ? '...' : ''),
              matchType: bestMatch.metadata?.type || 'qa_match',
              source: sourceInfo.source,
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
        
        return response;
      }

      // ===== TIER 2 & TIER 3: NO EXACT MATCH FROM VECTOR DB =====
      // Check if we have lower-confidence documents that might contain relevant PDF training data
      const hasLowerConfidenceDocs = searchResults.length > 0 && documentConfidence < 95;

      this.logger.log(`📊 TIER 2 (PDF Training): ${hasLowerConfidenceDocs ? 'Checking...' : 'NO'}`);
      this.logger.log(`📊 TIER 3 (AI Knowledge): Will be used as fallback`);

      // Build conversation context from history for AI
      const conversationContext = conversationHistory.slice(-5).map((msg: any) => {
          if (msg.userMessage) {
            return `User: ${msg.userMessage}`;
          } else if (msg.assistantMessage) {
            return `Assistant: ${msg.assistantMessage}`;
          }
          return '';
        }).filter(Boolean).join('\n');

      // TIER 2: Try to use PDF training data through AI
      // Collect PDF evidence from lower-confidence matches
      let pdfTrainingContext = '';
      if (hasLowerConfidenceDocs) {
        const pdfDocuments = searchResults.filter((doc: any) =>
          doc.metadata?.type === 'evidence' ||
          doc.metadata?.sourceFile?.endsWith('.pdf')
        ).slice(0, 3); // Top 3 PDF documents

        if (pdfDocuments.length > 0) {
          this.logger.log(`🎯 TIER 2 ACTIVATED: Found ${pdfDocuments.length} PDF training documents (${documentConfidence.toFixed(1)}% confidence)`);

          pdfTrainingContext = '\n\nRELEVANT TRAINING DATA FROM PDF DOCUMENTS:\n';
          pdfDocuments.forEach((doc: any, index: number) => {
            const evidence = doc.metadata?.evidenceText || doc.content || doc.text || '';
            const source = doc.metadata?.sourceFile || doc.metadata?.disease || 'PDF Document';
            const cleanedEvidence = this.cleanEvidenceText(evidence);

            pdfTrainingContext += `\n[Training Document ${index + 1}] Source: "${source}"\n`;
            pdfTrainingContext += `Content: ${cleanedEvidence.substring(0, 800)}...\n`;
          });

          pdfTrainingContext += '\n⚠️ IMPORTANT INSTRUCTIONS FOR USING TRAINING DATA:\n';
          pdfTrainingContext += '1. DO NOT modify or paraphrase the training data - use exact quotes\n';
          pdfTrainingContext += '2. ALWAYS cite the source document name when using training data\n';
          pdfTrainingContext += '3. If training data does not match the question, use your general knowledge instead\n';
        }
      }

      // Create comprehensive prompt for AI (TIER 2 + TIER 3)
      let contextualPrompt = '';

      if (pdfTrainingContext) {
        // TIER 2: PDF Training Data Mode
        contextualPrompt = `You are a helpful, empathetic AI assistant specialized in spiritual guidance and mental wellness.

${pdfTrainingContext}

${conversationContext ? `Previous conversation:\n${conversationContext}\n\n` : ''}User's current question: ${request.message}

RESPONSE GUIDELINES:
1. First, check if the training data above is relevant (similarity check)
2. If relevant: Use EXACT quotes from training data + cite the source document
3. If NOT relevant: Use your general AI knowledge + conversation context
4. Always be warm, empathetic, and supportive
5. Never modify training data - quote it exactly as written

FORMATTING REQUIREMENTS (VERY IMPORTANT):
- Preserve ALL line breaks from original text (use \n\n for paragraphs)
- Preserve bullet points and numbered lists exactly as they appear
- Preserve section headings and formatting
- Keep all whitespace and indentation from original
- Do NOT reformat or restructure the content

CITATION FORMAT (MANDATORY):
- When using training data, end your response with:
  "📚 Source: [Document Name]"
- Example: "📚 Source: Ibn Daud - A Handbook of Spiritual Medicine"

Provide your response with proper formatting and citation:`;
      } else {
        // TIER 3: Pure AI Knowledge + Context Mode
        this.logger.log(`🎯 TIER 3 ACTIVATED: No PDF training data available, using AI knowledge + context`);

        contextualPrompt = conversationContext
          ? `You are a helpful, empathetic AI assistant specialized in spiritual guidance and mental wellness. Respond naturally and conversationally.\n\nPrevious conversation:\n${conversationContext}\n\nUser's current question: ${request.message}\n\nProvide a helpful, warm, and supportive response based on your knowledge and the conversation context:`
          : `You are a helpful, empathetic AI assistant specialized in spiritual guidance and mental wellness. Respond naturally and conversationally.\n\nUser question: ${request.message}\n\nProvide a helpful, warm, and supportive response based on your knowledge:`;
      }

      // Generate AI response using Bedrock (for both TIER 2 and TIER 3)
      const aiGeneratedResponse = await this.bedrockService.invokeModel({
        messages: [{ role: 'user', content: contextualPrompt }],
        maxTokens: 500, // Increased for PDF context
        temperature: 0.7
      });

      // Add empathetic header to AI response
      const emotionalHeader = this.personalityService.generateEmpatheticHeader(
        emotionAnalysis.primaryEmotion,
        conversationHistory.length === 0,
        request.message
      );

      // Build AI response with proper citation
      let aiResponseContent = aiGeneratedResponse.content || 'I\'m here to support you. How can I help you further?';

      // Add source citation if using PDF training data
      if (pdfTrainingContext && searchResults.length > 0) {
        const sources = searchResults.slice(0, 3).map((doc: any) =>
          doc.metadata?.sourceFile || doc.metadata?.disease || 'PDF Document'
        ).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i); // unique sources

        // Check if Claude already added citation, if not add it
        if (!aiResponseContent.includes('📚 Source:') && !aiResponseContent.includes('Source:')) {
          aiResponseContent += `\n\n📚 **Source:** ${sources.join(', ')}`;
        }
      }

      const aiResponse = `${emotionalHeader}\n\n${aiResponseContent}`;

      const emotionTags = this.emotionService.generateResponseEmotionTags(emotionAnalysis);
      const emotionSummary = this.emotionService.getEmotionSummary(emotionAnalysis);
      const responseStyleText = this.emotionService.getResponseStyleText(emotionTags);

      const dummyMedia = this.mediaService.generateDummyMedia(
        emotionAnalysis.primaryEmotion,
        request.message,
        true // Enable media generation (static image + GIF)
      );

      // Determine which tier was actually used
      const activeTier = pdfTrainingContext ? 'tier-2-pdf-training' : 'tier-3-ai-knowledge';
      const tierMessage = pdfTrainingContext
        ? `TIER 2: AI using PDF training data (${searchResults.length} PDF documents found with ${documentConfidence.toFixed(1)}% confidence)`
        : `TIER 3: Pure AI knowledge + conversation context (no high-confidence training data available)`;

      this.logger.log(`✅ Response generated using ${activeTier.toUpperCase()}`);

      const response: ChatResponse = {
        id: messageId,
        content: aiResponse,
        media: dummyMedia,
        emotion: emotionAnalysis.primaryEmotion,
        emotionTags,
        confidence: pdfTrainingContext ? 75 : 65, // Higher confidence if using PDF training
        processingTime: Date.now() - startTime,
        metadata: {
          sessionId: request.sessionId,
          emotionAnalysis,
          emotionSummary,
          responseStyleText,
          documentsUsed: pdfTrainingContext ? searchResults.length : 0,
          documents: pdfTrainingContext ? searchResults.slice(0, 3).map((doc: any) => ({
            title: doc.metadata?.sourceFile || doc.metadata?.disease || 'PDF Document',
            relevanceScore: (doc.score * 100).toFixed(1) + '%',
            excerpt: (doc.metadata?.evidenceText || doc.content || '').substring(0, 200),
            type: 'pdf-training',
            source: doc.metadata?.sourceFile,
          })) : [],
          cached: false,
          contextInfo: {
            totalDocuments: searchResults.length,
            contextUsed: true,
            message: tierMessage,
            tier: activeTier,
            pdfTrainingUsed: !!pdfTrainingContext,
            firstMessage: conversationHistory.length === 0,
          },
          mode: activeTier,
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
          mode: activeTier,
          tier: activeTier,
          pdfDocumentsUsed: pdfTrainingContext ? searchResults.length : 0,
          media: dummyMedia,
        },
      });

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