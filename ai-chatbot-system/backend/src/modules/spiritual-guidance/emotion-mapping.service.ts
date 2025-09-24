import { Injectable, Logger } from '@nestjs/common';
import { EmotionService } from '../emotion/emotion.service';
import { EmotionalState } from './interfaces/spiritual-guidance.interface';

@Injectable()
export class EmotionMappingService {
  private readonly logger = new Logger(EmotionMappingService.name);

  constructor(private readonly emotionService: EmotionService) {}

  async analyzeEmotionalState(message: string): Promise<EmotionalState> {
    try {
      // Get basic emotion analysis from existing service
      const emotionAnalysis = await this.emotionService.analyzeEmotion(message);

      // Map to spiritual context
      const spiritualMapping = this.mapToSpiritualContext(emotionAnalysis, message);

      return {
        primaryEmotion: spiritualMapping.primaryEmotion,
        intensity: spiritualMapping.intensity,
        triggers: this.extractEmotionalTriggers(message),
        context: this.extractContext(message),
      };
    } catch (error) {
      this.logger.error('Failed to analyze emotional state', error);
      return this.getDefaultEmotionalState(message);
    }
  }

  private mapToSpiritualContext(emotionAnalysis: any, message: string) {
    const messageLower = message.toLowerCase();

    // Enhanced spiritual emotion mapping
    const spiritualEmotionMap = {
      // Anger mapping
      anger: {
        patterns: ['frustrated', 'angry', 'mad', 'furious', 'rage', 'annoyed', 'irritated', 'upset'],
        spiritualEmotion: 'anger',
        baseIntensity: 0.7
      },

      // Envy mapping
      envy: {
        patterns: ['jealous', 'envious', 'why do they', 'not fair', 'wish I had', 'they have', 'everyone else'],
        spiritualEmotion: 'envy',
        baseIntensity: 0.6
      },

      // Sadness/Depression -> Hard-heartedness
      sadness: {
        patterns: ['sad', 'depressed', 'empty', 'hopeless', 'lost', 'meaningless', 'nothing matters'],
        spiritualEmotion: 'hard-heartedness',
        baseIntensity: 0.5
      },

      // Fear -> Weak Faith
      fear: {
        patterns: ['scared', 'afraid', 'worried', 'anxious', 'panic', 'terrified', 'nervous'],
        spiritualEmotion: 'weak-faith',
        baseIntensity: 0.6
      },

      // Pride -> Arrogance
      pride: {
        patterns: ['better than', 'superior', 'deserve more', 'I am right', 'they are wrong'],
        spiritualEmotion: 'arrogance',
        baseIntensity: 0.8
      }
    };

    // Find the best matching spiritual emotion
    let bestMatch = { emotion: 'neutral', intensity: 0.3 };
    let maxScore = 0;

    for (const [emotion, config] of Object.entries(spiritualEmotionMap)) {
      const score = config.patterns.reduce((acc, pattern) => {
        return messageLower.includes(pattern) ? acc + 1 : acc;
      }, 0) / config.patterns.length;

      if (score > maxScore) {
        maxScore = score;
        bestMatch = {
          emotion: config.spiritualEmotion,
          intensity: Math.min(config.baseIntensity + (score * 0.3), 1.0)
        };
      }
    }

    // Use existing emotion service data if available
    if (emotionAnalysis && emotionAnalysis.dominant) {
      const serviceEmotion = emotionAnalysis.dominant.toLowerCase();

      // Enhance with service data
      if (serviceEmotion === 'anger' || serviceEmotion === 'rage') {
        bestMatch = { emotion: 'anger', intensity: Math.max(bestMatch.intensity, 0.7) };
      } else if (serviceEmotion === 'sadness' || serviceEmotion === 'depression') {
        bestMatch = { emotion: 'hard-heartedness', intensity: Math.max(bestMatch.intensity, 0.6) };
      } else if (serviceEmotion === 'fear' || serviceEmotion === 'anxiety') {
        bestMatch = { emotion: 'weak-faith', intensity: Math.max(bestMatch.intensity, 0.5) };
      }
    }

    return {
      primaryEmotion: bestMatch.emotion,
      intensity: bestMatch.intensity
    };
  }

  private extractEmotionalTriggers(message: string): string[] {
    const messageLower = message.toLowerCase();
    const triggers: string[] = [];

    // Common anger triggers
    const angerTriggers = [
      'someone said', 'they told me', 'people think', 'everyone says',
      'work', 'boss', 'colleague', 'family', 'spouse', 'children',
      'traffic', 'waiting', 'delay', 'late', 'slow'
    ];

    // Common envy triggers
    const envyTriggers = [
      'social media', 'instagram', 'facebook', 'friends', 'neighbors',
      'promotion', 'success', 'money', 'house', 'car', 'vacation',
      'relationship', 'marriage', 'children', 'job'
    ];

    // Common sadness triggers
    const sadnessTriggers = [
      'loss', 'death', 'breakup', 'divorce', 'failure', 'rejection',
      'loneliness', 'isolation', 'empty', 'meaningless', 'purpose'
    ];

    [angerTriggers, envyTriggers, sadnessTriggers].flat().forEach(trigger => {
      if (messageLower.includes(trigger)) {
        triggers.push(trigger);
      }
    });

    return triggers;
  }

  private extractContext(message: string): string {
    const messageLower = message.toLowerCase();

    // Context patterns
    const contexts = {
      work: ['job', 'work', 'office', 'boss', 'colleague', 'career', 'promotion'],
      family: ['family', 'spouse', 'husband', 'wife', 'children', 'kids', 'parents'],
      social: ['friends', 'social', 'party', 'gathering', 'people', 'community'],
      financial: ['money', 'salary', 'debt', 'expensive', 'afford', 'financial'],
      health: ['sick', 'illness', 'pain', 'tired', 'exhausted', 'health'],
      spiritual: ['prayer', 'allah', 'god', 'religion', 'mosque', 'quran', 'faith'],
      personal: ['myself', 'personal', 'identity', 'purpose', 'meaning', 'life']
    };

    for (const [context, keywords] of Object.entries(contexts)) {
      if (keywords.some(keyword => messageLower.includes(keyword))) {
        return context;
      }
    }

    return 'general';
  }

  private getDefaultEmotionalState(message: string): EmotionalState {
    return {
      primaryEmotion: 'neutral',
      intensity: 0.3,
      triggers: this.extractEmotionalTriggers(message),
      context: this.extractContext(message),
    };
  }

  async detectEmotionalPatterns(messages: string[]): Promise<{
    pattern: string;
    frequency: number;
    suggestedGuidance: string;
  }[]> {
    const patterns = [];

    // Analyze message sequence for patterns
    const emotionalStates = await Promise.all(
      messages.map(msg => this.analyzeEmotionalState(msg))
    );

    // Look for recurring themes
    const emotionCounts: Record<string, number> = emotionalStates.reduce((acc, state) => {
      acc[state.primaryEmotion] = (acc[state.primaryEmotion] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    for (const [emotion, count] of Object.entries(emotionCounts)) {
      if (count > 1) {
        patterns.push({
          pattern: `Recurring ${emotion}`,
          frequency: count / messages.length,
          suggestedGuidance: this.getSuggestedGuidance(emotion)
        });
      }
    }

    return patterns;
  }

  private getSuggestedGuidance(emotion: string): string {
    const guidanceMap: Record<string, string> = {
      'anger': 'Consider focusing on anger management techniques from Islamic teachings',
      'envy': 'Explore the spiritual remedies for envy (hasad) in the handbook',
      'hard-heartedness': 'Regular Quran recitation and dhikr may help soften the heart',
      'weak-faith': 'Strengthening faith through increased worship and remembrance',
      'arrogance': 'Humility practices and self-reflection exercises'
    };

    return guidanceMap[emotion] || 'General spiritual wellness practices may be beneficial';
  }
}