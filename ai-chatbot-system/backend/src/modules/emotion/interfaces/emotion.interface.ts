export type EmotionType = 
  | 'happy' 
  | 'sad' 
  | 'angry' 
  | 'fear' 
  | 'surprise' 
  | 'disgust' 
  | 'neutral'
  | 'confused'
  | 'grateful'
  | 'urgent';

export type EmotionIntensity = 'low' | 'medium' | 'high';

export interface EmotionAnalysis {
  primaryEmotion: EmotionType;
  secondaryEmotions: EmotionType[];
  intensity: EmotionIntensity;
  sentiment: {
    score: number;
    comparative: number;
    positive: string[];
    negative: string[];
  };
  confidence: number;
  urgencyLevel: 'low' | 'medium' | 'high';
  questionType: string;
  keywords: string[];
  processingTime: number;
}

export interface EmotionContext {
  emotion: EmotionType;
  contextPrompt: string;
  searchBoost: number;
  responseStyle: {
    tone: string;
    formality: 'casual' | 'neutral' | 'formal';
    empathyLevel: 'low' | 'medium' | 'high';
  };
}