import { Injectable, Logger } from '@nestjs/common';
import { SpiritualGuidanceResponse, EmotionalState } from './interfaces/spiritual-guidance.interface';

export interface QualityCheckResult {
  passed: boolean;
  score: number;
  checklist: QualityChecklist;
  recommendations: string[];
}

export interface QualityChecklist {
  hasEmotionalAcknowledgment: boolean;
  hasCitation: boolean;
  isAppropriateLength: boolean;
  maintainsBoundaries: boolean;
  isCulturallySensitive: boolean;
  followsTemplateFormat: boolean;
  includesActionableGuidance: boolean;
  preservesRespectfulTone: boolean;
}

@Injectable()
export class QualityControlService {
  private readonly logger = new Logger(QualityControlService.name);

  async validateResponse(
    response: SpiritualGuidanceResponse,
    originalMessage: string,
    emotionalState?: EmotionalState
  ): Promise<QualityCheckResult> {
    try {
      const checklist = await this.performQualityChecks(response, originalMessage, emotionalState);
      const score = this.calculateQualityScore(checklist);
      const recommendations = this.generateRecommendations(checklist, response);

      const result: QualityCheckResult = {
        passed: score >= 0.7, // Pass threshold of 70%
        score,
        checklist,
        recommendations,
      };

      this.logger.log('Quality control completed', {
        score: score.toFixed(2),
        passed: result.passed,
        failedChecks: Object.entries(checklist)
          .filter(([_, passed]) => !passed)
          .map(([check, _]) => check),
      });

      return result;
    } catch (error) {
      this.logger.error('Quality control failed', error);
      return this.getDefaultFailResult();
    }
  }

  private async performQualityChecks(
    response: SpiritualGuidanceResponse,
    _originalMessage: string,
    _emotionalState?: EmotionalState
  ): Promise<QualityChecklist> {
    // Analyze response quality
    // const responseText = response.response.toLowerCase();

    return {
      hasEmotionalAcknowledgment: this.checkEmotionalAcknowledgment(response.response),
      hasCitation: this.checkCitation(response),
      isAppropriateLength: this.checkLength(response.response),
      maintainsBoundaries: this.checkProfessionalBoundaries(response.response),
      isCulturallySensitive: this.checkCulturalSensitivity(response.response),
      followsTemplateFormat: this.checkTemplateFormat(response),
      includesActionableGuidance: this.checkActionableGuidance(response.response),
      preservesRespectfulTone: this.checkRespectfulTone(response.response),
    };
  }

  private checkEmotionalAcknowledgment(response: string): boolean {
    const acknowledgmentPatterns = [
      'I can sense',
      'I understand',
      'I hear',
      'I see',
      'This must be',
      'It sounds like',
      'It seems',
      'I recognize',
      'I notice',
      'feeling',
      'experience',
      'situation',
      'going through',
      'difficult',
      'challenging',
    ];

    const responseLower = response.toLowerCase();
    return acknowledgmentPatterns.some(pattern =>
      responseLower.includes(pattern.toLowerCase())
    );
  }

  private checkCitation(response: SpiritualGuidanceResponse): boolean {
    // Check if there are citations present
    if (response.citations && response.citations.length > 0) {
      return true;
    }

    // Check if response mentions the handbook or page references
    const citationIndicators = [
      'handbook',
      'page',
      'chapter',
      'according to',
      'as stated',
      'as mentioned',
      'the document',
      'spiritual medicine',
    ];

    const responseLower = response.response.toLowerCase();
    return citationIndicators.some(indicator =>
      responseLower.includes(indicator)
    );
  }

  private checkLength(response: string): boolean {
    const wordCount = response.split(/\s+/).length;
    return wordCount >= 20 && wordCount <= 500; // Reasonable response length
  }

  private checkProfessionalBoundaries(response: string): boolean {
    const inappropriatePatterns = [
      'I am a doctor',
      'I am a therapist',
      'medical advice',
      'diagnose',
      'prescription',
      'professional treatment',
      'you need therapy',
      'seek medical help immediately',
      'this is definitely',
      'I guarantee',
    ];

    const responseLower = response.toLowerCase();
    return !inappropriatePatterns.some(pattern =>
      responseLower.includes(pattern.toLowerCase())
    );
  }

  private checkCulturalSensitivity(response: string): boolean {
    const insensitivePatterns = [
      'your religion is wrong',
      'you should convert',
      'your beliefs are',
      'you must believe',
      'only islam',
      'other religions',
      'infidel',
      'kafir',
      'you are going to hell',
      'allah will punish',
      'you are a sinner',
    ];

    const responseLower = response.toLowerCase();
    return !insensitivePatterns.some(pattern =>
      responseLower.includes(pattern.toLowerCase())
    );
  }

  private checkTemplateFormat(response: SpiritualGuidanceResponse): boolean {
    const responseText = response.response;

    // Check if response follows expected template structure
    const hasIntroduction = responseText.length > 50; // Has substantial introduction
    const hasQuotationMarks = responseText.includes('"') && responseText.includes('"');
    const hasPageReference = /page \d+/i.test(responseText) || response.citations.length > 0;

    // For higher citation levels, expect more structured format
    switch (response.citationLevel) {
      case 'perfect_match':
        return hasIntroduction && (hasQuotationMarks || response.citations.length > 0) && hasPageReference;
      case 'related_theme':
        return hasIntroduction && (hasQuotationMarks || response.citations.length > 0);
      case 'general_guidance':
        return hasIntroduction;
      case 'no_direct_match':
        return hasIntroduction;
      default:
        return true;
    }
  }

  private checkActionableGuidance(response: string): boolean {
    const actionableIndicators = [
      'try',
      'consider',
      'practice',
      'remember',
      'reflect',
      'recite',
      'seek',
      'focus on',
      'begin with',
      'start by',
      'you can',
      'you might',
      'may help',
      'recommended',
      'suggested',
      'approach',
      'method',
      'technique',
    ];

    const responseLower = response.toLowerCase();
    return actionableIndicators.some(indicator =>
      responseLower.includes(indicator)
    );
  }

  private checkRespectfulTone(response: string): boolean {
    const disrespectfulPatterns = [
      'you always',
      'you never',
      'you should know better',
      'obviously',
      'clearly you',
      'you must',
      'you have to',
      'that\'s wrong',
      'you\'re being',
      'stop feeling',
      'just get over',
      'it\'s simple',
    ];

    const responseLower = response.toLowerCase();
    return !disrespectfulPatterns.some(pattern =>
      responseLower.includes(pattern.toLowerCase())
    );
  }

  private calculateQualityScore(checklist: QualityChecklist): number {
    const weights = {
      hasEmotionalAcknowledgment: 0.20, // 20% - Most important
      hasCitation: 0.15, // 15% - Core requirement
      isAppropriateLength: 0.10, // 10% - Basic requirement
      maintainsBoundaries: 0.15, // 15% - Safety requirement
      isCulturallySensitive: 0.15, // 15% - Safety requirement
      followsTemplateFormat: 0.10, // 10% - Structure requirement
      includesActionableGuidance: 0.10, // 10% - Usefulness requirement
      preservesRespectfulTone: 0.05, // 5% - Tone requirement
    };

    let totalScore = 0;
    for (const [check, passed] of Object.entries(checklist)) {
      const weight = weights[check as keyof QualityChecklist] || 0;
      if (passed) {
        totalScore += weight;
      }
    }

    return totalScore;
  }

  private generateRecommendations(
    checklist: QualityChecklist,
    response: SpiritualGuidanceResponse
  ): string[] {
    const recommendations: string[] = [];

    if (!checklist.hasEmotionalAcknowledgment) {
      recommendations.push(
        'Add emotional acknowledgment: Start with phrases like "I can sense..." or "I understand this must be..."'
      );
    }

    if (!checklist.hasCitation) {
      recommendations.push(
        'Include proper citations: Reference specific pages, quotes, or mention the Handbook of Spiritual Medicine'
      );
    }

    if (!checklist.isAppropriateLength) {
      if (response.response.split(/\s+/).length < 20) {
        recommendations.push('Expand response: Provide more detailed guidance and explanation');
      } else {
        recommendations.push('Shorten response: Keep responses concise and focused');
      }
    }

    if (!checklist.maintainsBoundaries) {
      recommendations.push(
        'Maintain professional boundaries: Avoid medical or therapeutic claims, focus on spiritual guidance'
      );
    }

    if (!checklist.isCulturallySensitive) {
      recommendations.push(
        'Improve cultural sensitivity: Use inclusive language and respect diverse backgrounds'
      );
    }

    if (!checklist.followsTemplateFormat) {
      recommendations.push(
        'Follow template format: Include proper structure with quotes, page references, and clear sections'
      );
    }

    if (!checklist.includesActionableGuidance) {
      recommendations.push(
        'Add actionable guidance: Include practical steps, suggestions, or techniques the user can apply'
      );
    }

    if (!checklist.preservesRespectfulTone) {
      recommendations.push(
        'Maintain respectful tone: Avoid judgmental language and use supportive, empathetic phrasing'
      );
    }

    return recommendations;
  }

  private getDefaultFailResult(): QualityCheckResult {
    return {
      passed: false,
      score: 0,
      checklist: {
        hasEmotionalAcknowledgment: false,
        hasCitation: false,
        isAppropriateLength: false,
        maintainsBoundaries: false,
        isCulturallySensitive: false,
        followsTemplateFormat: false,
        includesActionableGuidance: false,
        preservesRespectfulTone: false,
      },
      recommendations: ['Quality control system failed - manual review required'],
    };
  }

  async auditResponse(
    response: SpiritualGuidanceResponse,
    originalMessage: string
  ): Promise<{
    qualityScore: number;
    auditLog: string[];
    improvementSuggestions: string[];
  }> {
    const auditLog: string[] = [];
    const improvementSuggestions: string[] = [];

    // Audit citation accuracy
    if (response.citations.length > 0) {
      auditLog.push(`Found ${response.citations.length} citations`);

      // Check for citation format consistency
      const citationFormats = response.citations.map(c => typeof c.page);
      const hasConsistentFormat = citationFormats.every(format => format === 'number');

      if (!hasConsistentFormat) {
        improvementSuggestions.push('Ensure all citations have numeric page references');
      }
    }

    // Audit response appropriateness
    const wordCount = response.response.split(/\s+/).length;
    auditLog.push(`Response length: ${wordCount} words`);

    if (wordCount > 300) {
      improvementSuggestions.push('Consider making response more concise');
    }

    // Audit template usage
    auditLog.push(`Template used: ${response.templateUsed}`);
    auditLog.push(`Citation level: ${response.citationLevel}`);

    // Calculate final quality score
    const qualityCheck = await this.validateResponse(response, originalMessage);
    const qualityScore = qualityCheck.score;

    auditLog.push(`Final quality score: ${(qualityScore * 100).toFixed(1)}%`);

    return {
      qualityScore,
      auditLog,
      improvementSuggestions,
    };
  }
}