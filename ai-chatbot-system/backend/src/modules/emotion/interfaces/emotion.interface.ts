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
  allDetectedEmotions: EmotionType[]; // All emotions detected (for better context)
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
  aiEnhanced?: boolean; // Whether AI analysis was used
}

export interface ResponseEmotionTags {
  inputEmotions: EmotionType[]; // Emotions detected in user input
  responseEmotions: EmotionType[]; // Emotions that should be reflected in the response
  empathyLevel: 'low' | 'medium' | 'high';
  responseStyle: {
    tone: string;
    formality: 'casual' | 'neutral' | 'formal';
    supportLevel: 'basic' | 'supportive' | 'highly_supportive';
  };
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