import { Injectable, Logger } from '@nestjs/common';
import { BedrockService } from '../bedrock/bedrock.service';
import { CitationService, HybridCitationMatch } from './citation.service';
import { EmotionMappingService } from './emotion-mapping.service';
import { QualityControlService } from './quality-control.service';
import { CacheService } from '../cache/cache.service';
import { DocumentSearchService } from './document-search.service';
import { FineTunedGuidanceService } from './fine-tuned-guidance.service';
import {
  SpiritualGuidanceRequest,
  SpiritualGuidanceResponse,
  CitationMatch,
  DirectQuote,
} from './interfaces/spiritual-guidance.interface';

// Enhanced response interface for hybrid approach
export interface HybridSpiritualGuidanceResponse extends SpiritualGuidanceResponse {
  sourceTypes: ('structured' | 'documents' | 'ai_knowledge')[];
  documentSources?: string[];
  hybridConfidence: number;
  processingDetails?: {
    documentSearchTime: number;
    totalDocumentMatches: number;
    aiEnhancementApplied: boolean;
  };
}

@Injectable()
export class SpiritualGuidanceService {
  private readonly logger = new Logger(SpiritualGuidanceService.name);

  constructor(
    private readonly bedrockService: BedrockService,
    private readonly citationService: CitationService,
    private readonly emotionMappingService: EmotionMappingService,
    private readonly qualityControlService: QualityControlService,
    private readonly cacheService: CacheService,
    private readonly documentSearchService: DocumentSearchService,
    private readonly fineTunedGuidanceService: FineTunedGuidanceService,
  ) {}

  async provideSpiritualGuidance(request: SpiritualGuidanceRequest): Promise<HybridSpiritualGuidanceResponse> {
    try {
      this.logger.log('Providing fine-tuned spiritual guidance', {
        messageLength: request.message.length,
        useFineTuned: true
      });

      // NEW APPROACH: Use fine-tuned model instead of DynamoDB queries
      const fineTunedResponse = await this.fineTunedGuidanceService.provideSpiritualGuidance(request);

      // Convert to hybrid response format
      const hybridResponse: HybridSpiritualGuidanceResponse = {
        ...fineTunedResponse,
        sourceTypes: ['ai_knowledge'],
        documentSources: [],
        hybridConfidence: 0.85, // High confidence in fine-tuned approach
        processingDetails: {
          documentSearchTime: 0,
          totalDocumentMatches: 0,
          aiEnhancementApplied: true
        }
      };

      // Step 2: Apply quality control
      const validatedResponse = await this.validateFineTunedResponse(hybridResponse, request);

      this.logger.log('Fine-tuned spiritual guidance provided successfully', {
        citationLevel: validatedResponse.citationLevel,
        templateUsed: validatedResponse.templateUsed,
        sourceTypes: validatedResponse.sourceTypes,
        hybridConfidence: validatedResponse.hybridConfidence,
        qualityScore: validatedResponse.metadata?.qualityScore || 'N/A'
      });

      return validatedResponse;

    } catch (error) {
      this.logger.error('Failed to provide fine-tuned spiritual guidance, falling back to hybrid approach', error);
      return this.provideLegacySpiritualGuidance(request);
    }
  }

  /**
   * Legacy method using DynamoDB queries (fallback when fine-tuned approach fails)
   */
  async provideLegacySpiritualGuidance(request: SpiritualGuidanceRequest): Promise<HybridSpiritualGuidanceResponse> {
    try {
      this.logger.log('Using legacy spiritual guidance approach');

      // Step 1: Analyze emotional state
      const emotionalState = request.emotionalState ||
        await this.emotionMappingService.analyzeEmotionalState(request.message);

      // Step 2: Find hybrid citation match (structured + documents + AI)
      const citationMatch = await this.citationService.findCitationMatch(
        emotionalState,
        request.message
      ) as HybridCitationMatch;

      // Step 3: Generate hybrid response combining all sources
      const response = await this.generateHybridResponse(
        request,
        emotionalState,
        citationMatch
      );

      // Step 4: Apply quality control
      const validatedResponse = await this.validateResponse(response, request, emotionalState);

      this.logger.log('Legacy spiritual guidance provided successfully', {
        citationLevel: citationMatch.level,
        confidence: citationMatch.confidence,
        combinedConfidence: citationMatch.combinedConfidence,
        citationCount: citationMatch.relevantQuotes.length,
        sourceTypes: citationMatch.sourceTypes,
        documentMatches: citationMatch.documentMatches?.length || 0,
        qualityScore: validatedResponse.metadata?.qualityScore || 'N/A'
      });

      return validatedResponse;

    } catch (error) {
      this.logger.error('Failed to provide legacy spiritual guidance', error);
      return this.getFallbackResponse(request.message);
    }
  }

  /**
   * Validate fine-tuned response
   */
  private async validateFineTunedResponse(
    response: HybridSpiritualGuidanceResponse,
    _request: SpiritualGuidanceRequest
  ): Promise<HybridSpiritualGuidanceResponse> {
    try {
      // Basic validation for fine-tuned responses
      if (response.response.length < 50) {
        response.response += " I encourage you to continue seeking spiritual guidance and support in your journey.";
      }

      // Ensure empathetic tone
      if (!this.hasEmpatheticTone(response.response)) {
        response.response = "I understand you're going through a difficult time. " + response.response;
      }

      // Add quality metadata
      response.metadata = {
        ...response.metadata,
        validationApplied: 'fine_tuned',
        qualityScore: this.calculateBasicQualityScore(response.response),
        validatedAt: new Date().toISOString()
      };

      return response;
    } catch (error) {
      this.logger.warn('Fine-tuned validation failed, using basic validation', error);
      return response;
    }
  }

  /**
   * Check if response has empathetic tone
   */
  private hasEmpatheticTone(response: string): boolean {
    const empatheticPhrases = [
      'understand', 'hear', 'sense', 'feel', 'experience',
      'difficult', 'challenging', 'support', 'help'
    ];

    const responseLower = response.toLowerCase();
    return empatheticPhrases.some(phrase => responseLower.includes(phrase));
  }

  /**
   * Calculate basic quality score for fine-tuned responses
   */
  private calculateBasicQualityScore(response: string): number {
    let score = 0.5; // Base score

    // Length check
    if (response.length > 100 && response.length < 800) score += 0.2;

    // Empathy check
    if (this.hasEmpatheticTone(response)) score += 0.2;

    // Spiritual content check
    const spiritualTerms = ['allah', 'prayer', 'guidance', 'spiritual', 'wisdom', 'patience'];
    const hasSpiritual = spiritualTerms.some(term => response.toLowerCase().includes(term));
    if (hasSpiritual) score += 0.1;

    return Math.min(score, 1.0);
  }

  private async generateHybridResponse(
    request: SpiritualGuidanceRequest,
    emotionalState: any,
    citationMatch: HybridCitationMatch
  ): Promise<HybridSpiritualGuidanceResponse> {
    const startTime = Date.now();

    // Generate response using enhanced hybrid approach
    const baseResponse = await this.generateResponse(request, emotionalState, citationMatch);

    // Enhance response with document sources and AI knowledge
    const enhancedResponse = await this.enhanceResponseWithHybridSources(
      baseResponse,
      request,
      emotionalState,
      citationMatch
    );

    const processingTime = Date.now() - startTime;

    return {
      ...enhancedResponse,
      sourceTypes: citationMatch.sourceTypes,
      documentSources: citationMatch.documentMatches?.map(match => match.chunk.source) || [],
      hybridConfidence: citationMatch.combinedConfidence,
      processingDetails: {
        documentSearchTime: processingTime,
        totalDocumentMatches: citationMatch.documentMatches?.length || 0,
        aiEnhancementApplied: true
      }
    };
  }

  private async generateResponse(
    request: SpiritualGuidanceRequest,
    emotionalState: any,
    citationMatch: CitationMatch
  ): Promise<SpiritualGuidanceResponse> {

    const template = this.citationService.getResponseTemplate(citationMatch.level);

    if (!template) {
      throw new Error(`No template found for citation level: ${citationMatch.level}`);
    }

    let responseText: string;

    switch (citationMatch.level) {
      case 'perfect_match':
        responseText = await this.generatePerfectMatchResponse(
          request,
          emotionalState,
          citationMatch,
          template.template
        );
        break;

      case 'related_theme':
        responseText = await this.generateRelatedThemeResponse(
          request,
          emotionalState,
          citationMatch,
          template.template
        );
        break;

      case 'general_guidance':
        responseText = await this.generateGeneralGuidanceResponse(
          request,
          emotionalState,
          citationMatch,
          template.template
        );
        break;

      case 'no_direct_match':
        responseText = await this.generateConversationalResponse(
          request,
          emotionalState,
          template.template
        );
        break;

      default:
        responseText = "I'm here to listen and provide support based on spiritual wisdom.";
    }

    return {
      response: responseText,
      citations: citationMatch.relevantQuotes,
      spiritualDisease: citationMatch.spiritualDisease,
      citationLevel: citationMatch.level,
      templateUsed: template.name,
    };
  }

  private async generatePerfectMatchResponse(
    request: SpiritualGuidanceRequest,
    emotionalState: any,
    citationMatch: CitationMatch,
    template: string
  ): Promise<string> {
    const disease = citationMatch.spiritualDisease!;
    const mainQuote = citationMatch.relevantQuotes.find(q => q.context === 'symptoms') ||
                      citationMatch.relevantQuotes[0];
    const treatmentQuote = citationMatch.relevantQuotes.find(q => q.context === 'treatment');

    // Create contextual application using Claude
    const contextPrompt = `
Based on this user message: "${request.message}"
And this spiritual guidance: "${mainQuote.quote}"
Generate a brief, empathetic application of how this guidance relates to their specific situation.
Keep it to 1-2 sentences, speaking directly to their experience.
`;

    const applicationResponse = await this.bedrockService.invokeModel({
      messages: [{ role: 'user', content: contextPrompt }],
      maxTokens: 100,
      temperature: 0.7
    });

    let response = template
      .replace('{emotion}', emotionalState.primaryEmotion)
      .replace('{arabicName}', disease.arabicName)
      .replace('{englishName}', disease.name)
      .replace('{page}', mainQuote.page.toString())
      .replace('{quote}', mainQuote.quote)
      .replace('{application}', applicationResponse.content?.trim() || 'patience and reflection');

    if (treatmentQuote) {
      response = response
        .replace('{treatment}', this.extractTreatmentGuidance(treatmentQuote.quote))
        .replace('{treatmentPage}', treatmentQuote.page.toString())
        .replace('{treatmentQuote}', treatmentQuote.quote);
    } else {
      response = response
        .replace('{treatment}', 'patience and remembrance of Allah')
        .replace('{treatmentPage}', mainQuote.page.toString())
        .replace('{treatmentQuote}', mainQuote.quote);
    }

    return response;
  }

  private async generateRelatedThemeResponse(
    request: SpiritualGuidanceRequest,
    emotionalState: any,
    citationMatch: CitationMatch,
    template: string
  ): Promise<string> {
    const disease = citationMatch.spiritualDisease!;
    const mainQuote = citationMatch.relevantQuotes[0];
    const treatmentQuote = citationMatch.relevantQuotes.find(q => q.context === 'treatment') ||
                           citationMatch.relevantQuotes[1];

    const behaviorPattern = await this.identifyBehaviorPattern(request.message, emotionalState);
    const cause = this.extractCauseFromDisease(disease);

    let response = template
      .replace('{behaviorPattern}', behaviorPattern)
      .replace('{page}', mainQuote.page.toString())
      .replace('{quote}', mainQuote.quote)
      .replace('{cause}', cause);

    if (treatmentQuote) {
      response = response
        .replace('{treatmentPage}', treatmentQuote.page.toString())
        .replace('{treatmentQuote}', treatmentQuote.quote);
    }

    return response;
  }

  private async generateGeneralGuidanceResponse(
    request: SpiritualGuidanceRequest,
    emotionalState: any,
    citationMatch: CitationMatch,
    template: string
  ): Promise<string> {
    const mainQuote = citationMatch.relevantQuotes[0];
    const supportQuote = citationMatch.relevantQuotes[1] || mainQuote;

    // Generate contextual advice using Claude
    const advicePrompt = `
Given this user situation: "${request.message}"
And this spiritual principle: "${mainQuote.quote}"
Provide brief, practical advice on how to apply this principle to their situation.
Keep it to 1-2 sentences.
`;

    const adviceResponse = await this.bedrockService.invokeModel({
      messages: [{ role: 'user', content: advicePrompt }],
      maxTokens: 80,
      temperature: 0.7
    });

    const advice = adviceResponse.content || 'seek guidance through prayer and reflection';

    const topic = this.inferTopicFromQuote(mainQuote);

    return template
      .replace('{topic}', topic)
      .replace('{page}', mainQuote.page.toString())
      .replace('{quote}', mainQuote.quote)
      .replace('{advice}', advice.trim())
      .replace('{supportPage}', supportQuote.page.toString())
      .replace('{supportQuote}', supportQuote.quote);
  }

  /**
   * Enhance response by integrating document sources with AI knowledge
   */
  private async enhanceResponseWithHybridSources(
    baseResponse: SpiritualGuidanceResponse,
    request: SpiritualGuidanceRequest,
    emotionalState: any,
    citationMatch: HybridCitationMatch
  ): Promise<SpiritualGuidanceResponse> {
    try {
      // If we have document matches, integrate them with AI wisdom
      if (citationMatch.documentMatches && citationMatch.documentMatches.length > 0) {
        const documentInsights = citationMatch.documentMatches
          .slice(0, 3) // Use top 3 document matches
          .map(match => `"${match.chunk.content.slice(0, 150)}..." (from ${match.chunk.source})`)
          .join('\n\n');

        // Use AI to synthesize structured guidance + document insights + built-in knowledge
        const synthesisPrompt = `
You are providing spiritual guidance by combining multiple sources. Here's what you have:

1. STRUCTURED GUIDANCE: ${baseResponse.response}

2. RELEVANT DOCUMENT EXCERPTS:
${documentInsights}

3. USER MESSAGE: "${request.message}"

Now synthesize a comprehensive response that:
- Builds upon the structured guidance
- Incorporates relevant insights from the documents
- Adds your own spiritual wisdom where appropriate
- Maintains a warm, empathetic tone
- Provides practical, actionable guidance
- Keeps the response focused and not overly long (300-400 words max)

Integrate these sources naturally - don't just list them separately. Create a flowing, cohesive response that feels unified.`;

        const synthesizedResponse = await this.bedrockService.invokeModel({
          messages: [{ role: 'user', content: synthesisPrompt }],
          maxTokens: 500,
          temperature: 0.7
        });

        if (synthesizedResponse.content && synthesizedResponse.content.trim().length > 100) {
          return {
            ...baseResponse,
            response: synthesizedResponse.content.trim(),
          };
        }
      }

      // If no documents or synthesis failed, enhance with AI knowledge only
      return await this.enhanceWithAIKnowledge(baseResponse, request, emotionalState);

    } catch (error) {
      this.logger.warn('Hybrid enhancement failed, using base response', error);
      return baseResponse;
    }
  }

  /**
   * Enhance response with AI's built-in spiritual knowledge
   */
  private async enhanceWithAIKnowledge(
    baseResponse: SpiritualGuidanceResponse,
    request: SpiritualGuidanceRequest,
    emotionalState: any
  ): Promise<SpiritualGuidanceResponse> {
    try {
      // Only enhance if the base response seems limited
      if (baseResponse.response.length < 200 || baseResponse.citationLevel === 'no_direct_match') {
        const enhancementPrompt = `
A person is seeking spiritual guidance for this situation: "${request.message}"

They're experiencing: ${emotionalState.primaryEmotion}

The current guidance available is: "${baseResponse.response}"

Please provide additional spiritual wisdom and practical advice that complements this guidance. Focus on:
- Universal spiritual principles that apply to their situation
- Practical steps they can take
- Sources of comfort and strength
- Ways to grow from this experience

Keep your addition to 100-150 words, warm and supportive in tone.`;

        const aiWisdom = await this.bedrockService.invokeModel({
          messages: [{ role: 'user', content: enhancementPrompt }],
          maxTokens: 200,
          temperature: 0.8
        });

        if (aiWisdom.content && aiWisdom.content.trim().length > 50) {
          const enhancedResponse = baseResponse.response + '\n\n' + aiWisdom.content.trim();
          return {
            ...baseResponse,
            response: enhancedResponse
          };
        }
      }

      return baseResponse;
    } catch (error) {
      this.logger.warn('AI knowledge enhancement failed', error);
      return baseResponse;
    }
  }

  private async generateConversationalResponse(
    request: SpiritualGuidanceRequest,
    emotionalState: any,
    template: string
  ): Promise<string> {
    // Find context from conversation history
    const context = (request.conversationHistory && request.conversationHistory.length > 0) ?
      this.extractContextFromHistory(request.conversationHistory) :
      emotionalState.context;

    // Generate empathetic response using Claude
    const responsePrompt = `
Respond to this person with empathy and spiritual wisdom: "${request.message}"
Their emotional context is: ${context}
Provide support while acknowledging that you don't have specific handbook guidance for this exact situation.
Offer to share related spiritual wisdom if appropriate.
Keep it to 2-3 sentences, warm and supportive.
`;

    const responseResult = await this.bedrockService.invokeModel({
      messages: [{ role: 'user', content: responsePrompt }],
      maxTokens: 150,
      temperature: 0.8
    });

    const response = responseResult.content || 'I understand you\'re going through something difficult.';

    const relatedTopic = this.suggestRelatedTopic(emotionalState);

    return template
      .replace('{context}', context)
      .replace('{response}', response.trim())
      .replace('{relatedTopic}', relatedTopic);
  }

  private async validateResponse(
    response: HybridSpiritualGuidanceResponse,
    request: SpiritualGuidanceRequest,
    emotionalState: any
  ): Promise<HybridSpiritualGuidanceResponse> {
    try {
      // Use the comprehensive quality control service
      const qualityResult = await this.qualityControlService.validateResponse(
        response,
        request.message,
        emotionalState
      );

      // Add quality metadata to the response
      response.metadata = {
        ...response.metadata,
        qualityScore: qualityResult.score,
        qualityChecks: qualityResult.checklist,
        qualityPassed: qualityResult.passed,
        recommendations: qualityResult.recommendations,
      };

      // Apply automatic corrections for common issues
      if (!qualityResult.passed) {
        this.logger.warn('Quality control failed', {
          score: qualityResult.score.toFixed(2),
          failedChecks: Object.entries(qualityResult.checklist)
            .filter(([_, passed]) => !passed)
            .map(([check, _]) => check),
        });

        // Apply corrections
        const correctedBase = await this.applyQualityCorrections(response, qualityResult);
        response = {
          ...response,
          ...correctedBase
        };
      }

      return response;
    } catch (error) {
      this.logger.error('Quality validation failed', error);

      // Fallback to basic validation
      const basicValidated = this.applyBasicValidation(response);
      return {
        ...response,
        ...basicValidated
      };
    }
  }

  private async applyQualityCorrections(
    response: SpiritualGuidanceResponse,
    qualityResult: any
  ): Promise<SpiritualGuidanceResponse> {
    const correctedResponse = { ...response };

    // Apply specific corrections based on failed checks
    if (!qualityResult.checklist.hasEmotionalAcknowledgment) {
      correctedResponse.response = "I understand this must be difficult for you. " + correctedResponse.response;
    }

    if (!qualityResult.checklist.includesActionableGuidance) {
      correctedResponse.response += "\n\nConsider taking some time for reflection and prayer to find peace in this situation.";
    }

    if (!qualityResult.checklist.isAppropriateLength) {
      const wordCount = correctedResponse.response.split(/\s+/).length;
      if (wordCount < 20) {
        correctedResponse.response += " I encourage you to continue seeking spiritual guidance and reflecting on these teachings.";
      }
    }

    // Re-validate after corrections
    const revalidationResult = await this.qualityControlService.validateResponse(
      correctedResponse,
      "", // Original message not needed for re-validation
      undefined
    );

    correctedResponse.metadata = {
      ...correctedResponse.metadata,
      correctionApplied: true,
      originalQualityScore: qualityResult.score,
      correctedQualityScore: revalidationResult.score,
    };

    return correctedResponse;
  }

  private applyBasicValidation(response: SpiritualGuidanceResponse): SpiritualGuidanceResponse {
    // Basic fallback validation
    if (response.response.length < 20) {
      response.response += " I encourage you to seek further spiritual guidance and support.";
    }

    if (!response.response.toLowerCase().includes('understand') &&
        !response.response.toLowerCase().includes('sense') &&
        !response.response.toLowerCase().includes('hear')) {
      response.response = "I understand you're going through something difficult. " + response.response;
    }

    response.metadata = {
      ...response.metadata,
      basicValidationApplied: true,
      qualityScore: 0.5, // Default score when advanced validation fails
    };

    return response;
  }

  private getFallbackResponse(_message: string): HybridSpiritualGuidanceResponse {
    return {
      response: "I'm here to listen and provide support. While I don't have specific guidance for your exact situation in my training materials, I want you to know that your feelings are valid and that seeking spiritual guidance is a positive step. Would you like me to share some general principles from spiritual teachings that might offer comfort?",
      citations: [],
      citationLevel: 'no_direct_match',
      templateUsed: 'fallback',
      sourceTypes: ['ai_knowledge'],
      documentSources: [],
      hybridConfidence: 0.1,
      processingDetails: {
        documentSearchTime: 0,
        totalDocumentMatches: 0,
        aiEnhancementApplied: false
      }
    };
  }

  // Helper methods for template processing
  private extractTreatmentGuidance(quote: string): string {
    const treatments = [
      'patience and prayer',
      'remembrance of Allah',
      'seeking forgiveness',
      'reflection and self-examination',
      'charitable acts and helping others'
    ];

    // Simple keyword matching to extract relevant treatment
    const quoteLower = quote.toLowerCase();
    const matchedTreatment = treatments.find(treatment =>
      quoteLower.includes(treatment.split(' ')[0])
    );

    return matchedTreatment || 'spiritual reflection and prayer';
  }

  private async identifyBehaviorPattern(message: string, emotionalState: any): Promise<string> {
    const patterns: Record<string, string> = {
      'anger': 'frequent outbursts of anger',
      'envy': 'comparing yourself to others',
      'hard-heartedness': 'feeling spiritually disconnected',
      'weak-faith': 'struggling with doubt and fear',
      'arrogance': 'difficulty accepting criticism'
    };

    return patterns[emotionalState.primaryEmotion] || 'emotional struggles';
  }

  private extractCauseFromDisease(disease: any): string {
    const causes: Record<string, string> = {
      'Anger': 'lack of patience and self-control',
      'Envy': 'forgetting Allah\'s wisdom in distributing blessings',
      'Hard-heartedness': 'distance from spiritual remembrance',
      'Weak Faith': 'insufficient knowledge and practice',
      'Arrogance': 'pride and ego overwhelming humility'
    };

    return causes[disease.name] || 'spiritual imbalance';
  }

  private inferTopicFromQuote(quote: DirectQuote): string {
    const topicKeywords = {
      'patience': ['patient', 'patience', 'wait'],
      'remembrance': ['remember', 'dhikr', 'allah'],
      'prayer': ['pray', 'prayer', 'salah'],
      'forgiveness': ['forgive', 'forgiveness', 'mercy'],
      'gratitude': ['grateful', 'thanks', 'blessing']
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => quote.quote.toLowerCase().includes(keyword))) {
        return topic;
      }
    }

    return 'spiritual guidance';
  }

  private extractContextFromHistory(history: string[]): string {
    // Simple context extraction from conversation history
    const lastMessage = history[history.length - 1] || '';
    const contexts = ['work', 'family', 'relationships', 'personal growth', 'spiritual journey'];

    const matchedContext = contexts.find(context =>
      lastMessage.toLowerCase().includes(context)
    );

    return matchedContext || 'your previous concerns';
  }

  private suggestRelatedTopic(emotionalState: any): string {
    const suggestions: Record<string, string> = {
      'anger': 'anger management in Islamic teachings',
      'envy': 'contentment and gratitude practices',
      'hard-heartedness': 'heart purification methods',
      'weak-faith': 'strengthening faith and trust',
      'neutral': 'general spiritual wellness'
    };

    return suggestions[emotionalState.primaryEmotion] || 'spiritual self-care';
  }

  // Validation helper methods
  private hasEmotionalAcknowledgment(response: string): boolean {
    const acknowledgmentPatterns = [
      'I can sense', 'I understand', 'I hear', 'I see',
      'This must be', 'It sounds like', 'It seems'
    ];

    const responseLower = response.toLowerCase();
    return acknowledgmentPatterns.some(pattern =>
      responseLower.includes(pattern.toLowerCase())
    );
  }

  private maintainsProfessionalBoundaries(response: string): boolean {
    const inappropriatePatterns = [
      'I am a doctor', 'medical advice', 'diagnose', 'prescription',
      'therapy session', 'professional treatment'
    ];

    const responseLower = response.toLowerCase();
    return !inappropriatePatterns.some(pattern =>
      responseLower.includes(pattern)
    );
  }

  private isCulturallySensitive(response: string): boolean {
    // Basic check for cultural sensitivity
    const insensitivePatterns = [
      'your religion', 'your beliefs are wrong', 'convert to',
      'you should believe', 'your culture is'
    ];

    const responseLower = response.toLowerCase();
    return !insensitivePatterns.some(pattern =>
      responseLower.includes(pattern)
    );
  }
}