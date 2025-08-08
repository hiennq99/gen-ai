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
      happy: 'User seems positive and satisfied. Maintain upbeat and helpful tone.',
      sad: 'User may be experiencing difficulties. Show empathy and provide supportive responses.',
      angry: 'User appears frustrated. Remain calm, acknowledge concerns, and provide clear solutions.',
      fear: 'User seems worried or anxious. Provide reassuring and clear information.',
      surprise: 'User is experiencing something unexpected. Provide clear explanations.',
      disgust: 'User has negative reaction. Address concerns professionally.',
      neutral: 'User has neutral tone. Provide balanced and informative responses.',
      confused: 'User needs clarification. Provide clear, step-by-step explanations.',
      grateful: 'User is expressing gratitude. Acknowledge and continue being helpful.',
      urgent: 'User has urgent needs. Prioritize quick, actionable responses.',
    };

    return contexts[emotion] || contexts.neutral;
  }
}