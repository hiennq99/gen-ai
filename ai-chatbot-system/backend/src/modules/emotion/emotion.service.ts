import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import Sentiment from 'sentiment';
import { EmotionAnalysis, EmotionType, EmotionIntensity, ResponseEmotionTags } from './interfaces/emotion.interface';

@Injectable()
export class EmotionService {
  private readonly logger = new Logger(EmotionService.name);
  private readonly sentiment: any;
  private readonly bedrockClient: BedrockRuntimeClient;
  private readonly useAIAnalysis: boolean;
  
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

  constructor(private configService: ConfigService) {
    this.sentiment = new Sentiment();
    this.customizeSentiment();

    // Initialize Bedrock client for AI-powered emotion analysis
    const region = this.configService.get<string>('aws.region');
    const accessKeyId = this.configService.get<string>('aws.accessKeyId');
    const secretAccessKey = this.configService.get<string>('aws.secretAccessKey');

    this.bedrockClient = new BedrockRuntimeClient({
      region,
      credentials: accessKeyId && secretAccessKey ? {
        accessKeyId,
        secretAccessKey,
      } : undefined,
    });

    // Disable AI analysis for channel program accounts - use keyword detection instead
    // Enable AI analysis if AWS credentials are properly configured
    this.useAIAnalysis = false; // Temporarily disabled due to channel program account restrictions
    // this.useAIAnalysis = !!(accessKeyId && secretAccessKey &&
    //                       accessKeyId !== 'your_access_key' &&
    //                       secretAccessKey !== 'your_secret_key' &&
    //                       !accessKeyId.startsWith('your_'));
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

      // Use AI-powered analysis if available, otherwise fallback to keyword-based
      let detectedEmotions: EmotionType[] = [];
      let aiConfidence = 0;

      if (this.useAIAnalysis) {
        try {
          const aiResult = await this.analyzeEmotionWithAI(text);
          detectedEmotions = aiResult.emotions;
          aiConfidence = aiResult.confidence;
          this.logger.debug(`AI emotion detection: ${JSON.stringify(aiResult)}`);
        } catch (aiError: any) {
          // Don't log error for access denied or validation exceptions - just use fallback
          if (aiError.name !== 'ValidationException' && aiError.name !== 'AccessDeniedException') {
            this.logger.warn('AI emotion analysis failed, falling back to keyword detection:', aiError.message);
          }
          detectedEmotions = this.detectEmotions(text);
        }
      } else {
        detectedEmotions = this.detectEmotions(text);
      }

      const sentimentResult = this.sentiment.analyze(text);
      const intensity = this.detectIntensity(text);
      const primaryEmotion = this.determinePrimaryEmotion(detectedEmotions, sentimentResult);

      const urgencyLevel = this.detectUrgency(text);
      const questionType = this.classifyQuestionType(text);

      // Filter and limit secondary emotions to top 3
      const secondaryEmotions = detectedEmotions
        .filter(e => e !== primaryEmotion)
        .slice(0, 3);

      const analysis: EmotionAnalysis = {
        primaryEmotion,
        secondaryEmotions,
        allDetectedEmotions: detectedEmotions,
        intensity,
        sentiment: {
          score: sentimentResult.score,
          comparative: sentimentResult.comparative,
          positive: sentimentResult.positive,
          negative: sentimentResult.negative,
        },
        confidence: this.useAIAnalysis
          ? Math.max(aiConfidence, this.calculateConfidence(sentimentResult, detectedEmotions))
          : this.calculateConfidence(sentimentResult, detectedEmotions),
        urgencyLevel,
        questionType,
        keywords: this.extractKeywords(text),
        processingTime: Date.now() - startTime,
        aiEnhanced: this.useAIAnalysis,
      };

      this.logger.debug(`Emotion analysis completed: ${JSON.stringify(analysis)}`);
      return analysis;
    } catch (error) {
      this.logger.error('Error analyzing emotion:', error);
      return this.getDefaultAnalysis();
    }
  }

  private async analyzeEmotionWithAI(text: string): Promise<{ emotions: EmotionType[]; confidence: number }> {
    const prompt = `
Analyze the following text for multiple emotions and classify them from this list:
- happy
- sad
- angry
- fear
- surprise
- disgust
- neutral
- confused
- grateful
- urgent

Text: "${text}"

Return a JSON response with:
1. "emotions": Array of detected emotions (up to 5, ordered by strength)
2. "confidence": Overall confidence score (0-100)

Example: {"emotions": ["happy", "grateful", "excited"], "confidence": 85}
`;

    try {
      const modelId = this.configService.get<string>('aws.bedrock.modelId') || 'anthropic.claude-3-sonnet-20240229-v1:0';

      const params = {
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 200,
          temperature: 0.3,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        }),
      };

      const command = new InvokeModelCommand(params);
      const response = await this.bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      // Extract the response content
      const content = responseBody.content?.[0]?.text || responseBody.completion || '';

      // Parse the JSON response
      const result = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());

      // Validate emotions are from our allowed list
      const allowedEmotions: EmotionType[] = ['happy', 'sad', 'angry', 'fear', 'surprise', 'disgust', 'neutral', 'confused', 'grateful', 'urgent'];
      const validEmotions = result.emotions?.filter((emotion: string) =>
        allowedEmotions.includes(emotion as EmotionType)
      ) || ['neutral'];

      return {
        emotions: validEmotions.slice(0, 5), // Limit to top 5 emotions
        confidence: Math.min(Math.max(result.confidence || 70, 0), 100)
      };
    } catch (error: any) {
      // Only log error details for non-permission issues
      if (error.name !== 'ValidationException' && error.name !== 'AccessDeniedException') {
        this.logger.error('AI emotion analysis error:', error.message);
      }
      throw error;
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
      allDetectedEmotions: ['neutral'],
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
      aiEnhanced: false,
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

  getEmotionDisplayText(emotions: EmotionType[]): string {
    if (!emotions || emotions.length === 0) {
      return 'No specific emotions detected';
    }

    const emotionLabels = {
      happy: 'Happy',
      sad: 'Sad',
      angry: 'Angry',
      fear: 'Fearful',
      surprise: 'Surprised',
      disgust: 'Disgusted',
      neutral: 'Neutral',
      confused: 'Confused',
      grateful: 'Grateful',
      urgent: 'Urgent'
    };

    if (emotions.length === 1) {
      return emotionLabels[emotions[0]] || emotions[0];
    }

    if (emotions.length === 2) {
      return `${emotionLabels[emotions[0]]} and ${emotionLabels[emotions[1]]}`;
    }

    const lastEmotion = emotions[emotions.length - 1];
    const otherEmotions = emotions.slice(0, -1);
    const otherLabels = otherEmotions.map(e => emotionLabels[e] || e);

    return `${otherLabels.join(', ')}, and ${emotionLabels[lastEmotion]}`;
  }

  getEmotionSummary(emotionAnalysis: EmotionAnalysis): string {
    const { primaryEmotion, secondaryEmotions, intensity, confidence, urgencyLevel } = emotionAnalysis;

    let summary = `Primary emotion: ${this.getEmotionDisplayText([primaryEmotion])}`;

    if (secondaryEmotions && secondaryEmotions.length > 0) {
      summary += ` | Secondary: ${this.getEmotionDisplayText(secondaryEmotions)}`;
    }

    summary += ` | Intensity: ${intensity}`;

    if (urgencyLevel !== 'low') {
      summary += ` | Urgency: ${urgencyLevel}`;
    }

    summary += ` | Confidence: ${Math.round(confidence)}%`;

    if (emotionAnalysis.aiEnhanced) {
      summary += ' | AI Enhanced';
    }

    return summary;
  }

  getResponseStyleText(emotionTags: ResponseEmotionTags): string {
    const { responseEmotions, empathyLevel, responseStyle } = emotionTags;

    let styleText = `Response emotions: ${this.getEmotionDisplayText(responseEmotions)}`;
    styleText += ` | Empathy: ${empathyLevel}`;
    styleText += ` | Tone: ${responseStyle.tone}`;
    styleText += ` | Formality: ${responseStyle.formality}`;
    styleText += ` | Support: ${responseStyle.supportLevel}`;

    return styleText;
  }

  generateResponseEmotionTags(emotionAnalysis: EmotionAnalysis): ResponseEmotionTags {
    const { primaryEmotion, allDetectedEmotions, intensity, urgencyLevel } = emotionAnalysis;

    // Determine appropriate response emotions based on detected emotions
    const responseEmotions = this.getAppropriateResponseEmotions(allDetectedEmotions);

    // Calculate empathy level based on emotion intensity and type
    const empathyLevel = this.determineEmpathyLevel(primaryEmotion, intensity, urgencyLevel);

    // Determine response style based on emotions and context
    const responseStyle = this.getResponseStyle(primaryEmotion, empathyLevel, urgencyLevel);

    return {
      inputEmotions: allDetectedEmotions,
      responseEmotions,
      empathyLevel,
      responseStyle,
    };
  }

  private getAppropriateResponseEmotions(inputEmotions: EmotionType[]): EmotionType[] {
    const responseMapping: Record<EmotionType, EmotionType[]> = {
      happy: ['happy', 'grateful'],
      sad: ['grateful', 'neutral'], // Be supportive but not overly emotional
      angry: ['neutral', 'grateful'], // Stay calm and understanding
      fear: ['grateful', 'neutral'], // Be reassuring
      surprise: ['surprise', 'happy'],
      disgust: ['neutral', 'grateful'],
      neutral: ['neutral', 'happy'],
      confused: ['neutral', 'grateful'], // Be patient and helpful
      grateful: ['grateful', 'happy'],
      urgent: ['urgent', 'grateful'], // Match urgency but stay professional
    };

    const responseEmotions = new Set<EmotionType>();

    // Add appropriate responses for each input emotion
    inputEmotions.forEach(emotion => {
      const responses = responseMapping[emotion] || ['neutral'];
      responses.forEach(resp => responseEmotions.add(resp));
    });

    return Array.from(responseEmotions).slice(0, 3); // Limit to top 3
  }

  private determineEmpathyLevel(
    primaryEmotion: EmotionType,
    intensity: EmotionIntensity,
    urgencyLevel: 'low' | 'medium' | 'high'
  ): 'low' | 'medium' | 'high' {
    // High empathy for negative or intense emotions
    if (['sad', 'angry', 'fear', 'confused'].includes(primaryEmotion)) {
      return intensity === 'high' ? 'high' : 'medium';
    }

    // High empathy for urgent situations
    if (urgencyLevel === 'high') {
      return 'high';
    }

    // Medium empathy for positive emotions
    if (['happy', 'grateful', 'surprise'].includes(primaryEmotion)) {
      return 'medium';
    }

    return 'low';
  }

  private getResponseStyle(
    primaryEmotion: EmotionType,
    _empathyLevel: 'low' | 'medium' | 'high',
    urgencyLevel: 'low' | 'medium' | 'high'
  ): {
    tone: string;
    formality: 'casual' | 'neutral' | 'formal';
    supportLevel: 'basic' | 'supportive' | 'highly_supportive';
  } {
    const baseStyle = {
      tone: 'friendly',
      formality: 'neutral' as const,
      supportLevel: 'basic' as const,
    };

    // Adjust based on primary emotion
    switch (primaryEmotion) {
      case 'happy':
      case 'grateful':
        return {
          ...baseStyle,
          tone: 'enthusiastic',
          formality: 'casual' as const,
          supportLevel: 'supportive' as const,
        };

      case 'sad':
      case 'fear':
        return {
          ...baseStyle,
          tone: 'compassionate',
          formality: 'neutral' as const,
          supportLevel: 'highly_supportive' as const,
        };

      case 'angry':
        return {
          ...baseStyle,
          tone: 'calm',
          formality: 'neutral' as const,
          supportLevel: 'highly_supportive' as const,
        };

      case 'confused':
        return {
          ...baseStyle,
          tone: 'patient',
          formality: 'neutral' as const,
          supportLevel: 'supportive' as const,
        };

      case 'urgent':
        const formalityLevel = urgencyLevel === 'high' ? 'formal' : 'neutral';
        return {
          ...baseStyle,
          tone: 'professional',
          formality: formalityLevel as 'formal' | 'neutral',
          supportLevel: 'highly_supportive' as const,
        };

      default:
        return baseStyle;
    }
  }
}