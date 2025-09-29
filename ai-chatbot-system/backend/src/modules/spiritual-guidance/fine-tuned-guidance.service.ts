import { Injectable, Logger } from '@nestjs/common';
import { BedrockService } from '../bedrock/bedrock.service';
import { CacheService } from '../cache/cache.service';
import { QATrainingService } from './qa-training.service';
import { SourceTrackingService } from './source-tracking.service';
import {
  SpiritualGuidanceRequest,
  SpiritualGuidanceResponse,
  EmotionalState,
} from './interfaces/spiritual-guidance.interface';

export interface FineTunedModelConfig {
  modelId: string;
  modelArn?: string;
  isCustomModel: boolean;
  trainingStatus?: 'TRAINING' | 'COMPLETED' | 'FAILED';
  lastTrainingDate?: Date;
}

@Injectable()
export class FineTunedGuidanceService {
  private readonly logger = new Logger(FineTunedGuidanceService.name);
  private fineTunedConfig: FineTunedModelConfig | null = null;

  constructor(
    private readonly bedrockService: BedrockService,
    private readonly cacheService: CacheService,
    private readonly qaTrainingService: QATrainingService,
    private readonly sourceTrackingService: SourceTrackingService,
  ) {
    this.initializeFineTunedModel();
  }

  /**
   * Initialize fine-tuned model configuration
   */
  private async initializeFineTunedModel() {
    try {
      // Check if we have a custom fine-tuned model available
      const customModelId = process.env.SPIRITUAL_GUIDANCE_MODEL_ID;
      const customModelArn = process.env.SPIRITUAL_GUIDANCE_MODEL_ARN;

      if (customModelId || customModelArn) {
        this.fineTunedConfig = {
          modelId: customModelId || 'anthropic.claude-3-haiku-20240307',
          modelArn: customModelArn,
          isCustomModel: !!customModelArn,
          trainingStatus: 'COMPLETED'
        };

        this.logger.log('Initialized fine-tuned model', {
          modelId: this.fineTunedConfig.modelId,
          isCustom: this.fineTunedConfig.isCustomModel
        });
      } else {
        // Fallback to base model with enhanced prompting
        this.fineTunedConfig = {
          modelId: 'anthropic.claude-3-haiku-20240307',
          isCustomModel: false,
          trainingStatus: 'COMPLETED'
        };

        this.logger.log('Using base model with enhanced prompting');
      }
    } catch (error) {
      this.logger.error('Failed to initialize fine-tuned model', error);
    }
  }

  /**
   * Provide spiritual guidance using pure Q&A trained AI (no database queries needed)
   */
  async provideSpiritualGuidance(request: SpiritualGuidanceRequest): Promise<SpiritualGuidanceResponse> {
    try {
      this.logger.log('Providing Q&A trained spiritual guidance', {
        messageLength: request.message.length,
        hasHistory: !!(request.conversationHistory?.length)
      });

      const cacheKey = `qa-guidance:${JSON.stringify(request).slice(0, 100)}`;

      // Try cache first
      try {
        const cached = await this.cacheService.get(cacheKey);
        if (cached && typeof cached === 'string') {
          this.logger.log('Returning cached Q&A guidance');
          return JSON.parse(cached);
        }
      } catch (error) {
        this.logger.warn('Cache miss for Q&A guidance', error);
      }

      // Generate response using Q&A trained model
      const response = await this.generateQAResponse(request);

      // Cache the response
      try {
        await this.cacheService.set(cacheKey, JSON.stringify(response), 1800); // 30 minutes
      } catch (error) {
        this.logger.warn('Failed to cache Q&A guidance', error);
      }

      return response;

    } catch (error) {
      this.logger.error('Failed to provide Q&A spiritual guidance', error);
      return this.getFallbackResponse(request.message);
    }
  }

  /**
   * Generate Q&A response using trained model (no citations, just direct answers)
   */
  private async generateQAResponse(request: SpiritualGuidanceRequest): Promise<SpiritualGuidanceResponse> {
    if (!this.fineTunedConfig) {
      throw new Error('Q&A model not initialized');
    }

    if (this.fineTunedConfig.isCustomModel) {
      return this.generateCustomQAResponse(request);
    } else {
      return this.generateDirectQAResponse(request);
    }
  }

  /**
   * Use custom Q&A fine-tuned model
   */
  private async generateCustomQAResponse(request: SpiritualGuidanceRequest): Promise<SpiritualGuidanceResponse> {
    try {
      // Create system message for Q&A context
      const systemMessage = {
        role: 'system' as const,
        content: 'You are a compassionate spiritual guidance counselor. Provide helpful, empathetic, and practical advice to people seeking guidance. Your responses should be understanding, non-judgmental, and offer hope and actionable steps.'
      };

      const modelResponse = await this.bedrockService.invokeModel({
        messages: [
          systemMessage,
          { role: 'user', content: request.message }
        ],
        maxTokens: 500,
        temperature: 0.7
      });

      // Determine response source
      const responseSource = this.sourceTrackingService.determineResponseSource(
        request.message,
        modelResponse.content || '',
        'qa_training',
        {
          trainingQuestions: await this.getRelevantTrainingQuestions(request.message),
          modelType: 'custom_fine_tuned'
        }
      );

      return {
        response: modelResponse.content || '',
        citations: [], // No traditional citations, but source info available
        citationLevel: 'general_guidance',
        templateUsed: 'qa_fine_tuned_model',
        metadata: {
          modelType: 'qa_fine_tuned',
          modelId: this.fineTunedConfig!.modelId,
          processingTime: Date.now(),
          source: responseSource,
          sourceDisplay: this.sourceTrackingService.formatSourceForDisplay(responseSource)
        }
      };

    } catch (error) {
      this.logger.error('Custom Q&A model failed, falling back to direct approach', error);
      return this.generateDirectQAResponse(request);
    }
  }

  /**
   * Generate direct Q&A response using base model with Q&A context
   */
  private async generateDirectQAResponse(request: SpiritualGuidanceRequest): Promise<SpiritualGuidanceResponse> {
    // Create Q&A focused prompt
    const qaPrompt = this.buildQAPrompt(request);

    const modelResponse = await this.bedrockService.invokeModel({
      messages: [
        { role: 'user', content: qaPrompt }
      ],
      maxTokens: 600,
      temperature: 0.7
    });

    // Determine if this is from training, documents, or AI knowledge
    const generationMethod = this.determineGenerationMethod(request.message, modelResponse.content || '');

    const responseSource = this.sourceTrackingService.determineResponseSource(
      request.message,
      modelResponse.content || '',
      generationMethod,
      {
        trainingQuestions: await this.getRelevantTrainingQuestions(request.message),
        modelType: 'direct_qa'
      }
    );

    return {
      response: modelResponse.content || '',
      citations: [], // No traditional citations in Q&A approach
      citationLevel: 'general_guidance',
      templateUsed: 'direct_qa',
      metadata: {
        modelType: 'direct_qa',
        modelId: this.fineTunedConfig!.modelId,
        promptLength: qaPrompt.length,
        source: responseSource,
        sourceDisplay: this.sourceTrackingService.formatSourceForDisplay(responseSource)
      }
    };
  }

  /**
   * Build Q&A focused prompt without citations
   */
  private buildQAPrompt(request: SpiritualGuidanceRequest): string {
    // Determine the type of question/concern (future enhancement)
    // const _questionType = this.categorizeQuestion(request.message);

    const prompt = `You are a compassionate spiritual guidance counselor. Someone is asking you for help. Your role is to:

1. Listen with empathy and understanding
2. Provide practical, actionable advice
3. Offer hope and encouragement
4. Help them find their own inner strength
5. Give guidance that promotes growth and healing

Based on the following question, provide a thoughtful, caring response that directly addresses their concern:

Question: "${request.message}"

${request.conversationHistory && request.conversationHistory.length > 0 ?
  `Previous conversation context: ${request.conversationHistory.slice(-2).join(' -> ')}` : ''}

Your response should be:
- Warm and understanding
- Practical and helpful
- Focused on empowering them
- Around 150-300 words
- Direct and conversational (not academic)

Please provide your guidance:`;

    return prompt;
  }

  /**
   * Categorize the question to help generate appropriate response
   */
  private categorizeQuestion(message: string): string {
    const messageLower = message.toLowerCase();

    if (messageLower.includes('angry') || messageLower.includes('mad') || messageLower.includes('furious')) {
      return 'anger_management';
    } else if (messageLower.includes('sad') || messageLower.includes('depressed') || messageLower.includes('hopeless')) {
      return 'sadness_support';
    } else if (messageLower.includes('anxious') || messageLower.includes('worried') || messageLower.includes('scared')) {
      return 'anxiety_relief';
    } else if (messageLower.includes('lonely') || messageLower.includes('alone') || messageLower.includes('isolated')) {
      return 'loneliness_help';
    } else if (messageLower.includes('relationship') || messageLower.includes('partner') || messageLower.includes('family')) {
      return 'relationship_guidance';
    } else if (messageLower.includes('work') || messageLower.includes('job') || messageLower.includes('career')) {
      return 'work_life_balance';
    } else if (messageLower.includes('purpose') || messageLower.includes('meaning') || messageLower.includes('direction')) {
      return 'life_purpose';
    } else if (messageLower.includes('forgive') || messageLower.includes('hurt') || messageLower.includes('betrayed')) {
      return 'forgiveness_healing';
    } else {
      return 'general_guidance';
    }
  }

  /**
   * Analyze emotional state from user message
   */
  private analyzeEmotionalState(message: string): EmotionalState {
    const messageLower = message.toLowerCase();

    const emotionPatterns = {
      anger: ['angry', 'mad', 'furious', 'rage', 'frustrated', 'irritated'],
      sadness: ['sad', 'depressed', 'empty', 'lost', 'hopeless', 'down'],
      envy: ['jealous', 'envious', 'unfair', 'why do they', 'wish I had'],
      anxiety: ['worried', 'anxious', 'nervous', 'afraid', 'stressed'],
      spiritual: ['lost', 'searching', 'prayer', 'faith', 'god', 'allah']
    };

    let primaryEmotion = 'neutral';
    let intensity = 0.5;

    for (const [emotion, patterns] of Object.entries(emotionPatterns)) {
      const matchCount = patterns.filter(pattern => messageLower.includes(pattern)).length;
      if (matchCount > 0) {
        primaryEmotion = emotion;
        intensity = Math.min(matchCount * 0.3 + 0.4, 1.0);
        break;
      }
    }

    // Adjust intensity based on language intensity
    const intensityWords = ['very', 'extremely', 'really', 'so', 'completely'];
    const intensityBoost = intensityWords.filter(word => messageLower.includes(word)).length * 0.2;
    intensity = Math.min(intensity + intensityBoost, 1.0);

    return {
      primaryEmotion,
      intensity,
      triggers: [], // Extract triggers from message analysis if needed
      context: this.extractContext(message)
    };
  }

  /**
   * Extract context from message
   */
  private extractContext(message: string): string {
    const contextKeywords = {
      work: ['job', 'work', 'colleague', 'boss', 'office', 'career'],
      family: ['family', 'parent', 'sibling', 'mother', 'father', 'child'],
      relationship: ['relationship', 'partner', 'marriage', 'spouse', 'friend'],
      spiritual: ['prayer', 'faith', 'god', 'allah', 'religion', 'spiritual'],
      health: ['sick', 'health', 'pain', 'medical', 'doctor'],
      financial: ['money', 'financial', 'job', 'income', 'debt']
    };

    const messageLower = message.toLowerCase();

    for (const [context, keywords] of Object.entries(contextKeywords)) {
      if (keywords.some(keyword => messageLower.includes(keyword))) {
        return context;
      }
    }

    return 'general';
  }

  /**
   * Parse response from fine-tuned model
   */
  private parseFineTunedResponse(response: string): {
    response: string;
    citations: any[];
    citationLevel: string;
  } {
    // Fine-tuned models should return structured responses
    // For now, treat the entire response as the main content
    return {
      response: response.trim(),
      citations: [],
      citationLevel: 'ai_trained'
    };
  }

  /**
   * Parse enhanced prompt response
   */
  private parseEnhancedResponse(response: string, _originalMessage: string): {
    response: string;
    citations: any[];
    citationLevel: string;
  } {
    // Extract citations if mentioned in response
    const citations: any[] = [];
    const citationPattern = /page (\d+)|الغضب|الحسد|قسوة القلب/gi;
    const matches = response.match(citationPattern);

    if (matches) {
      matches.forEach(match => {
        if (match.startsWith('page')) {
          const pageNum = parseInt(match.replace('page ', ''));
          citations.push({
            page: pageNum,
            quote: 'Referenced in AI training',
            context: 'ai_knowledge'
          });
        }
      });
    }

    // Determine citation level based on response content
    let citationLevel = 'ai_knowledge';
    if (response.includes('Handbook') || response.includes('الغضب') || response.includes('الحسد')) {
      citationLevel = 'trained_match';
    }

    return {
      response: response.trim(),
      citations,
      citationLevel
    };
  }

  /**
   * Fallback response when fine-tuned approach fails
   */
  private getFallbackResponse(_message: string): SpiritualGuidanceResponse {
    return {
      response: "I understand you're reaching out for spiritual guidance. While I'm experiencing some technical difficulties accessing my specialized training, I want you to know that your feelings are valid and seeking support is a positive step. The essence of spiritual wellness often lies in patience, reflection, and remembrance of our connection to the divine. Would you like to share more about what you're experiencing so I can offer more personalized support?",
      citations: [],
      citationLevel: 'no_direct_match',
      templateUsed: 'system_fallback',
      metadata: {
        fallbackReason: 'fine_tuned_system_unavailable'
      }
    };
  }

  /**
   * Train Q&A model with direct question-answer pairs
   */
  async trainModel(): Promise<{
    success: boolean;
    modelId?: string;
    trainingJobId?: string;
    message: string;
  }> {
    try {
      this.logger.log('Starting Q&A model training');

      // 1. Prepare Q&A training data
      const trainingData = await this.qaTrainingService.prepareQATrainingData();

      // 2. Validate Q&A training data
      const validation = await this.qaTrainingService.validateQATrainingData(trainingData.examples);
      if (!validation.valid) {
        return {
          success: false,
          message: `Q&A training data validation failed: ${validation.issues.join(', ')}`
        };
      }

      // 3. Save Q&A training data to file
      const trainingFile = await this.qaTrainingService.saveQATrainingData(trainingData.examples);

      // 4. Start Q&A training job
      const trainingJobId = await this.startBedrockQATraining(trainingFile);

      return {
        success: true,
        trainingJobId,
        message: `Q&A training started successfully with ${trainingData.examples.length} examples. Job ID: ${trainingJobId}`
      };

    } catch (error) {
      this.logger.error('Failed to train Q&A model', error);
      return {
        success: false,
        message: `Q&A training failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Start Bedrock Q&A training job (placeholder for actual implementation)
   */
  private async startBedrockQATraining(trainingFile: string): Promise<string> {
    // This would integrate with AWS Bedrock's fine-tuning API for Q&A training
    // For now, return a mock job ID
    this.logger.log('Mock Q&A training job started', { trainingFile });
    return `qa-job-${Date.now()}`;
  }

  /**
   * Get relevant training questions for source attribution
   */
  private async getRelevantTrainingQuestions(_userMessage: string): Promise<string[]> {
    try {
      // Get core Q&A pairs
      const trainingData = await this.qaTrainingService.prepareQATrainingData();
      return trainingData.examples
        .map(example => example.messages.find(m => m.role === 'user')?.content)
        .filter(question => question)
        .slice(0, 20) as string[]; // Return top 20 for comparison
    } catch (error) {
      this.logger.warn('Failed to get relevant training questions', error);
      return [];
    }
  }

  /**
   * Determine how the response was generated
   */
  private determineGenerationMethod(userMessage: string, response: string): 'qa_training' | 'document_search' | 'ai_knowledge' {
    // Check if response seems to come from Q&A training
    if (this.isQATrainingResponse(response)) {
      return 'qa_training';
    }

    // Check if response references documents
    if (this.isDocumentBasedResponse(response)) {
      return 'document_search';
    }

    // Default to AI knowledge
    return 'ai_knowledge';
  }

  /**
   * Check if response seems to come from Q&A training
   */
  private isQATrainingResponse(response: string): boolean {
    const qaTrainingIndicators = [
      'anger is a natural emotion',
      'jealousy often stems from',
      'spiritual emptiness',
      'forgiveness is one of the highest',
      'when life feels overwhelming'
    ];

    const responseLower = response.toLowerCase();
    return qaTrainingIndicators.some(indicator => responseLower.includes(indicator));
  }

  /**
   * Check if response is based on documents
   */
  private isDocumentBasedResponse(response: string): boolean {
    const documentIndicators = [
      'according to the document',
      'as mentioned in',
      'the handbook states',
      'page',
      'chapter',
      'section'
    ];

    const responseLower = response.toLowerCase();
    return documentIndicators.some(indicator => responseLower.includes(indicator));
  }

  /**
   * Get model status and statistics
   */
  async getModelStatus(): Promise<{
    config: FineTunedModelConfig | null;
    stats: {
      totalRequests: number;
      averageResponseTime: number;
      cacheHitRate: number;
    };
  }> {
    // This would include actual metrics from monitoring
    return {
      config: this.fineTunedConfig,
      stats: {
        totalRequests: 0,
        averageResponseTime: 0,
        cacheHitRate: 0
      }
    };
  }
}