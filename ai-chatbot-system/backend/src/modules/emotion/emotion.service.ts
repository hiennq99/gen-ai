import { Injectable, Logger } from '@nestjs/common';
import * as Sentiment from 'sentiment';
import { EmotionAnalysis, EmotionType, EmotionIntensity } from './interfaces/emotion.interface';

@Injectable()
export class EmotionService {
  private readonly logger = new Logger(EmotionService.name);
  private readonly sentiment: Sentiment;
  
  private readonly emotionKeywords = {
    happy: ['happy', 'joy', 'excited', 'delighted', 'pleased', 'glad', 'cheerful', 'vui', 'hạnh phúc'],
    sad: ['sad', 'unhappy', 'depressed', 'miserable', 'sorrowful', 'buồn', 'thất vọng'],
    angry: ['angry', 'mad', 'furious', 'annoyed', 'irritated', 'frustrated', 'giận', 'tức'],
    fear: ['afraid', 'scared', 'worried', 'anxious', 'nervous', 'terrified', 'sợ', 'lo lắng'],
    surprise: ['surprised', 'amazed', 'astonished', 'shocked', 'stunned', 'ngạc nhiên', 'bất ngờ'],
    disgust: ['disgusted', 'revolted', 'repulsed', 'sick', 'ghê', 'kinh tởm'],
    neutral: ['okay', 'fine', 'normal', 'regular', 'bình thường', 'ổn'],
    confused: ['confused', 'puzzled', 'unclear', 'lost', 'không hiểu', 'bối rối', 'khó hiểu'],
    grateful: ['thank', 'thanks', 'grateful', 'appreciate', 'cảm ơn', 'biết ơn'],
    urgent: ['urgent', 'emergency', 'asap', 'immediately', 'khẩn cấp', 'gấp', 'ngay'],
  };

  private readonly intensityModifiers = {
    high: ['very', 'extremely', 'really', 'so', 'incredibly', 'rất', 'cực kỳ', 'quá'],
    medium: ['quite', 'rather', 'fairly', 'pretty', 'khá', 'tương đối'],
    low: ['slightly', 'a bit', 'somewhat', 'a little', 'hơi', 'một chút'],
  };

  constructor() {
    this.sentiment = new Sentiment();
    this.customizeSentiment();
  }

  private customizeSentiment() {
    const vietnameseWords = {
      'tốt': 3,
      'hay': 2,
      'xuất sắc': 4,
      'tuyệt vời': 4,
      'xấu': -3,
      'tệ': -3,
      'kém': -2,
      'dở': -2,
      'thất vọng': -3,
      'tức giận': -3,
      'buồn': -2,
      'vui': 2,
      'hạnh phúc': 3,
      'lo lắng': -2,
      'sợ hãi': -3,
    };

    Object.entries(vietnameseWords).forEach(([word, score]) => {
      this.sentiment.registerLanguage('vi', { labels: { [word]: score } });
    });
  }

  async analyzeEmotion(text: string): Promise<EmotionAnalysis> {
    try {
      const startTime = Date.now();
      
      const sentimentResult = this.sentiment.analyze(text);
      
      const detectedEmotions = this.detectEmotions(text);
      const intensity = this.detectIntensity(text);
      const primaryEmotion = this.determinePrimaryEmotion(detectedEmotions, sentimentResult);
      
      const urgencyLevel = this.detectUrgency(text);
      const questionType = this.classifyQuestionType(text);
      
      const analysis: EmotionAnalysis = {
        primaryEmotion,
        secondaryEmotions: detectedEmotions.filter(e => e !== primaryEmotion),
        intensity,
        sentiment: {
          score: sentimentResult.score,
          comparative: sentimentResult.comparative,
          positive: sentimentResult.positive,
          negative: sentimentResult.negative,
        },
        confidence: this.calculateConfidence(sentimentResult, detectedEmotions),
        urgencyLevel,
        questionType,
        keywords: this.extractKeywords(text),
        processingTime: Date.now() - startTime,
      };

      this.logger.debug(`Emotion analysis completed: ${JSON.stringify(analysis)}`);
      return analysis;
    } catch (error) {
      this.logger.error('Error analyzing emotion:', error);
      return this.getDefaultAnalysis();
    }
  }

  private detectEmotions(text: string): EmotionType[] {
    const detectedEmotions: EmotionType[] = [];
    const lowerText = text.toLowerCase();

    Object.entries(this.emotionKeywords).forEach(([emotion, keywords]) => {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        detectedEmotions.push(emotion as EmotionType);
      }
    });

    return detectedEmotions.length > 0 ? detectedEmotions : ['neutral'];
  }

  private detectIntensity(text: string): EmotionIntensity {
    const lowerText = text.toLowerCase();
    
    const hasExclamation = (text.match(/!/g) || []).length;
    const hasCaps = text.length > 10 && text === text.toUpperCase();
    
    if (this.intensityModifiers.high.some(mod => lowerText.includes(mod)) || hasExclamation > 2 || hasCaps) {
      return 'high';
    }
    
    if (this.intensityModifiers.low.some(mod => lowerText.includes(mod))) {
      return 'low';
    }
    
    return 'medium';
  }

  private determinePrimaryEmotion(
    detectedEmotions: EmotionType[],
    sentimentResult: any,
  ): EmotionType {
    if (detectedEmotions.length === 0) {
      return 'neutral';
    }

    if (detectedEmotions.includes('urgent')) {
      return 'urgent';
    }

    if (sentimentResult.score > 3) {
      return detectedEmotions.includes('happy') ? 'happy' : 'grateful';
    } else if (sentimentResult.score < -3) {
      return detectedEmotions.includes('angry') ? 'angry' : 'sad';
    }

    return detectedEmotions[0];
  }

  private detectUrgency(text: string): 'low' | 'medium' | 'high' {
    const urgentKeywords = ['urgent', 'emergency', 'asap', 'immediately', 'now', 'khẩn cấp', 'gấp', 'ngay'];
    const lowerText = text.toLowerCase();
    
    if (urgentKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'high';
    }
    
    if (text.includes('!') || text.includes('HELP')) {
      return 'medium';
    }
    
    return 'low';
  }

  private classifyQuestionType(text: string): string {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('how') || lowerText.includes('làm thế nào')) {
      return 'how-to';
    }
    if (lowerText.includes('what') || lowerText.includes('là gì')) {
      return 'definition';
    }
    if (lowerText.includes('why') || lowerText.includes('tại sao')) {
      return 'explanation';
    }
    if (lowerText.includes('when') || lowerText.includes('khi nào')) {
      return 'timing';
    }
    if (lowerText.includes('where') || lowerText.includes('ở đâu')) {
      return 'location';
    }
    if (lowerText.includes('problem') || lowerText.includes('issue') || lowerText.includes('vấn đề')) {
      return 'troubleshooting';
    }
    
    return 'general';
  }

  private extractKeywords(text: string): string[] {
    const stopWords = ['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was', 'were', 'been', 'be'];
    const words = text.toLowerCase().split(/\W+/);
    
    return words
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .slice(0, 10);
  }

  private calculateConfidence(sentimentResult: any, detectedEmotions: EmotionType[]): number {
    const sentimentConfidence = Math.min(Math.abs(sentimentResult.comparative) * 20, 50);
    const emotionConfidence = detectedEmotions.length > 0 ? 30 : 0;
    const wordConfidence = sentimentResult.words?.length > 0 ? 20 : 0;
    
    return Math.min(sentimentConfidence + emotionConfidence + wordConfidence, 100);
  }

  private getDefaultAnalysis(): EmotionAnalysis {
    return {
      primaryEmotion: 'neutral',
      secondaryEmotions: [],
      intensity: 'medium',
      sentiment: {
        score: 0,
        comparative: 0,
        positive: [],
        negative: [],
      },
      confidence: 50,
      urgencyLevel: 'low',
      questionType: 'general',
      keywords: [],
      processingTime: 0,
    };
  }

  getEmotionContext(emotion: EmotionType): string {
    const contexts = {
      happy: `The user is feeling positive! Match their energy with enthusiasm and celebrate with them. 
        Share their joy and keep the conversation uplifting. Use phrases like "That's fantastic!" or "I'm so excited for you!"`,
      
      sad: `The user is going through a tough time. Be their supportive friend - validate their feelings first.
        Say things like "I hear you, and I'm really sorry you're going through this." Offer comfort before solutions.
        Sometimes they just need someone to listen and understand.`,
      
      angry: `The user is frustrated or upset. Be their calm, understanding friend who truly listens.
        Acknowledge their feelings: "I completely understand why you'd feel that way." 
        Don't dismiss their anger - validate it, then gently guide toward resolution.`,
      
      fear: `The user is anxious or worried. Be their reassuring friend who provides comfort and confidence.
        Use calming language: "I understand this feels scary, but we'll figure it out together."
        Break things down into manageable steps and remind them of their strength.`,
      
      surprise: `The user is experiencing something unexpected! Share in their amazement or help them process.
        React naturally: "Wow, that IS surprising!" Help them understand what's happening while matching their energy.`,
      
      disgust: `The user is having a strong negative reaction. Validate their feelings without judgment.
        "That does sound unpleasant" or "I can see why that would bother you." Help them process and move forward.`,
      
      neutral: `The user has a calm, balanced tone. Be friendly and approachable, ready to engage warmly.
        Keep things conversational and show genuine interest in helping them.`,
      
      confused: `The user needs clarity and patience. Be their patient friend who explains without condescension.
        "No worries at all, let me break this down differently." Use analogies and check for understanding.
        Remember: there are no stupid questions between friends.`,
      
      grateful: `The user is thankful! Accept their gratitude warmly and reinforce the friendship.
        "You're so welcome! I'm always happy to help" or "That's what friends are for!"
        This strengthens your bond.`,
      
      urgent: `The user needs immediate help. Be their reliable friend in crisis - calm but swift.
        "I'm on it right away" or "Let's tackle this immediately." Show you understand the urgency while staying composed.`,
    };

    return contexts[emotion] || contexts.neutral;
  }
}