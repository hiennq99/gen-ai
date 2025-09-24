import { Injectable, Logger } from '@nestjs/common';
import { BedrockService } from '../bedrock/bedrock.service';
import { CitationService } from './citation.service';
import { EmotionMappingService } from './emotion-mapping.service';
import { QualityControlService } from './quality-control.service';
import { CacheService } from '../cache/cache.service';
import {
  SpiritualGuidanceRequest,
  SpiritualGuidanceResponse,
  CitationMatch,
  DirectQuote,
} from './interfaces/spiritual-guidance.interface';

@Injectable()
export class SpiritualGuidanceService {
  private readonly logger = new Logger(SpiritualGuidanceService.name);

  constructor(
    private readonly bedrockService: BedrockService,
    private readonly citationService: CitationService,
    private readonly emotionMappingService: EmotionMappingService,
    private readonly qualityControlService: QualityControlService,
    private readonly cacheService: CacheService,
  ) {}

  async provideSpiritualGuidance(request: SpiritualGuidanceRequest): Promise<SpiritualGuidanceResponse> {
    try {
      this.logger.log('Providing spiritual guidance for message', {
        messageLength: request.message.length
      });

      // Step 1: Analyze emotional state
      const emotionalState = request.emotionalState ||
        await this.emotionMappingService.analyzeEmotionalState(request.message);

      // Step 2: Find citation match
      const citationMatch = await this.citationService.findCitationMatch(
        emotionalState,
        request.message
      );

      // Step 3: Generate response using appropriate template
      const response = await this.generateResponse(
        request,
        emotionalState,
        citationMatch
      );

      // Step 4: Apply quality control
      const validatedResponse = await this.validateResponse(response, request, emotionalState);

      this.logger.log('Spiritual guidance provided successfully', {
        citationLevel: citationMatch.level,
        confidence: citationMatch.confidence,
        citationCount: citationMatch.relevantQuotes.length,
        qualityScore: validatedResponse.metadata?.qualityScore || 'N/A'
      });

      return validatedResponse;

    } catch (error) {
      this.logger.error('Failed to provide spiritual guidance', error);
      return this.getFallbackResponse(request.message);
    }
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
    response: SpiritualGuidanceResponse,
    request: SpiritualGuidanceRequest,
    emotionalState: any
  ): Promise<SpiritualGuidanceResponse> {
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
        response = await this.applyQualityCorrections(response, qualityResult);
      }

      return response;
    } catch (error) {
      this.logger.error('Quality validation failed', error);

      // Fallback to basic validation
      return this.applyBasicValidation(response);
    }
  }

  private async applyQualityCorrections(
    response: SpiritualGuidanceResponse,
    qualityResult: any
  ): Promise<SpiritualGuidanceResponse> {
    let correctedResponse = { ...response };

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

  private getFallbackResponse(message: string): SpiritualGuidanceResponse {
    return {
      response: "I'm here to listen and provide support. While I don't have specific guidance for your exact situation in my training materials, I want you to know that your feelings are valid and that seeking spiritual guidance is a positive step. Would you like me to share some general principles from spiritual teachings that might offer comfort?",
      citations: [],
      citationLevel: 'no_direct_match',
      templateUsed: 'fallback',
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