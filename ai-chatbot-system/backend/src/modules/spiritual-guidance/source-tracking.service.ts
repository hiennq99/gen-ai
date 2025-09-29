import { Injectable, Logger } from '@nestjs/common';

export interface ResponseSource {
  type: 'qa_training' | 'document' | 'handbook' | 'ai_knowledge';
  reference: string;
  location?: string;
  originalQuestion?: string;
  documentPath?: string;
  pageNumber?: number;
  confidence: number;
}

export interface SourcedResponse {
  response: string;
  sources: ResponseSource[];
  primarySource: ResponseSource;
  citationLevel: string;
  templateUsed: string;
  metadata?: any;
}

@Injectable()
export class SourceTrackingService {
  private readonly logger = new Logger(SourceTrackingService.name);

  /**
   * Determine the source of a response based on how it was generated
   */
  determineResponseSource(
    userMessage: string,
    generatedResponse: string,
    generationMethod: 'qa_training' | 'document_search' | 'ai_knowledge',
    additionalInfo?: any
  ): ResponseSource {
    const confidence = this.calculateSourceConfidence(userMessage, generatedResponse, generationMethod);

    switch (generationMethod) {
      case 'qa_training':
        return this.createQATrainingSource(userMessage, additionalInfo, confidence);

      case 'document_search':
        return this.createDocumentSource(additionalInfo, confidence);

      case 'ai_knowledge':
        return this.createAIKnowledgeSource(userMessage, confidence);

      default:
        return this.createAIKnowledgeSource(userMessage, 0.1);
    }
  }

  /**
   * Create source info for Q&A training responses
   */
  private createQATrainingSource(userMessage: string, additionalInfo?: any, confidence: number = 0.8): ResponseSource {
    // Try to find the most similar training question
    const similarQuestion = this.findSimilarTrainingQuestion(userMessage, additionalInfo?.trainingQuestions || []);

    return {
      type: 'qa_training',
      reference: similarQuestion || 'Q&A Training Dataset',
      originalQuestion: similarQuestion,
      confidence,
      location: additionalInfo?.trainingSetIndex ? `Training Example #${additionalInfo.trainingSetIndex}` : undefined
    };
  }

  /**
   * Create source info for document-based responses
   */
  private createDocumentSource(additionalInfo?: any, confidence: number = 0.7): ResponseSource {
    return {
      type: 'document',
      reference: additionalInfo?.documentName || 'Uploaded Document',
      documentPath: additionalInfo?.filePath,
      pageNumber: additionalInfo?.pageNumber,
      location: additionalInfo?.pageNumber ? `Page ${additionalInfo.pageNumber}` : additionalInfo?.section,
      confidence
    };
  }

  /**
   * Create source info for AI knowledge responses
   */
  private createAIKnowledgeSource(userMessage: string, confidence: number = 0.5): ResponseSource {
    return {
      type: 'ai_knowledge',
      reference: 'AI General Knowledge',
      location: 'Generated response based on general spiritual guidance principles',
      confidence
    };
  }

  /**
   * Find the most similar question from training data
   */
  private findSimilarTrainingQuestion(userMessage: string, trainingQuestions: string[]): string | undefined {
    if (!trainingQuestions || trainingQuestions.length === 0) {
      return undefined;
    }

    const userWords = userMessage.toLowerCase().split(' ').filter(word => word.length > 3);
    let bestMatch = '';
    let bestScore = 0;

    for (const question of trainingQuestions) {
      const questionWords = question.toLowerCase().split(' ').filter(word => word.length > 3);
      const commonWords = userWords.filter(word => questionWords.includes(word));
      const score = commonWords.length / Math.max(userWords.length, questionWords.length);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = question;
      }
    }

    return bestScore > 0.3 ? bestMatch : undefined;
  }

  /**
   * Calculate confidence based on generation method and content analysis
   */
  private calculateSourceConfidence(
    userMessage: string,
    response: string,
    method: 'qa_training' | 'document_search' | 'ai_knowledge'
  ): number {
    let baseConfidence = 0.5;

    switch (method) {
      case 'qa_training':
        baseConfidence = 0.8;
        break;
      case 'document_search':
        baseConfidence = 0.7;
        break;
      case 'ai_knowledge':
        baseConfidence = 0.5;
        break;
    }

    // Adjust confidence based on response quality indicators
    if (response.length > 100 && response.length < 1000) {
      baseConfidence += 0.1;
    }

    if (response.includes('spiritual') || response.includes('guidance') || response.includes('wisdom')) {
      baseConfidence += 0.05;
    }

    return Math.min(baseConfidence, 1.0);
  }

  /**
   * Create multiple sources for hybrid responses
   */
  createHybridSources(
    userMessage: string,
    response: string,
    qaMatch?: any,
    documentMatch?: any,
    aiEnhanced: boolean = false
  ): ResponseSource[] {
    const sources: ResponseSource[] = [];

    // Add Q&A training source if available
    if (qaMatch) {
      sources.push(this.createQATrainingSource(userMessage, qaMatch, 0.8));
    }

    // Add document source if available
    if (documentMatch) {
      sources.push(this.createDocumentSource(documentMatch, 0.7));
    }

    // Add AI knowledge source if enhanced or fallback
    if (aiEnhanced || sources.length === 0) {
      sources.push(this.createAIKnowledgeSource(userMessage, sources.length > 0 ? 0.3 : 0.5));
    }

    return sources;
  }

  /**
   * Format source information for display
   */
  formatSourceForDisplay(source: ResponseSource): string {
    switch (source.type) {
      case 'qa_training':
        if (source.originalQuestion) {
          return `Based on training Q&A: "${source.originalQuestion.substring(0, 60)}${source.originalQuestion.length > 60 ? '...' : ''}"`;
        }
        return `From Q&A Training Dataset`;

      case 'document':
        if (source.pageNumber && source.documentPath) {
          return `From document "${source.reference}" (Page ${source.pageNumber})`;
        } else if (source.location) {
          return `From document "${source.reference}" (${source.location})`;
        }
        return `From uploaded document: ${source.reference}`;

      case 'handbook':
        if (source.pageNumber) {
          return `From Spiritual Handbook (Page ${source.pageNumber})`;
        }
        return `From Spiritual Handbook`;

      case 'ai_knowledge':
        return `Generated using AI spiritual guidance knowledge`;

      default:
        return `From ${source.reference || 'unknown source'}`;
    }
  }

  /**
   * Get source icon for UI display
   */
  getSourceIcon(sourceType: string): string {
    switch (sourceType) {
      case 'qa_training':
        return '📚';
      case 'document':
        return '📄';
      case 'handbook':
        return '📖';
      case 'ai_knowledge':
        return '🤖';
      default:
        return '❓';
    }
  }

  /**
   * Validate if a source provides sufficient attribution
   */
  validateSourceAttribution(source: ResponseSource): boolean {
    if (!source.type || !source.reference) {
      return false;
    }

    switch (source.type) {
      case 'qa_training':
        return !!source.originalQuestion || !!source.reference;
      case 'document':
        return !!source.documentPath || !!source.location;
      case 'handbook':
        return !!source.pageNumber || !!source.location;
      case 'ai_knowledge':
        return true; // AI knowledge doesn't require specific attribution
      default:
        return false;
    }
  }
}