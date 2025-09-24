export interface SpiritualDisease {
  name: string;
  arabicName: string;
  pageRange: string;
  emotionalTriggers: string[];
  directQuotes: DirectQuote[];
  quranicEvidence: QuranicEvidence[];
  hadithEvidence: HadithEvidence[];
}

export interface DirectQuote {
  page: number;
  quote: string;
  context: 'symptoms' | 'treatment' | 'evidence' | 'general';
}

export interface QuranicEvidence {
  page: number;
  verse: string;
  reference: string;
}

export interface HadithEvidence {
  page: number;
  hadith: string;
  source: string;
}

export interface CitationMatch {
  level: 'perfect_match' | 'related_theme' | 'general_guidance' | 'no_direct_match';
  spiritualDisease?: SpiritualDisease;
  relevantQuotes: DirectQuote[];
  confidence: number;
}

export interface EmotionalState {
  primaryEmotion: string;
  intensity: number;
  triggers: string[];
  context: string;
}

export interface SpiritualGuidanceRequest {
  message: string;
  emotionalState?: EmotionalState;
  conversationHistory?: string[];
}

export interface SpiritualGuidanceResponse {
  response: string;
  citations: DirectQuote[];
  spiritualDisease?: SpiritualDisease;
  citationLevel: CitationMatch['level'];
  templateUsed: string;
  metadata?: any;
}

export interface ResponseTemplate {
  name: string;
  level: CitationMatch['level'];
  template: string;
}