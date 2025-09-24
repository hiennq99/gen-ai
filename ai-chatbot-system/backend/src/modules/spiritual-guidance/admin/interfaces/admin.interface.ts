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

export interface HandbookContent {
  id?: string;
  title: string;
  arabicTitle?: string;
  chapter: string;
  pageStart: number;
  pageEnd: number;
  content: string;
  spiritualDiseases: string[];
  quotes: DirectQuote[];
  quranicVerses: QuranicEvidence[];
  hadithReferences: HadithEvidence[];
  keywords: string[];
  emotionalTriggers: string[];
}

export interface TrainingData {
  id?: string;
  type: 'spiritual_disease' | 'citation' | 'response_template' | 'handbook_content';
  content: any;
  status: 'active' | 'inactive' | 'pending_review';
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
}

export interface CitationAnalytics {
  totalCitations: number;
  citationsByLevel: Record<string, number>;
  popularDiseases: Array<{ name: string; count: number }>;
  qualityScores: {
    average: number;
    distribution: Record<string, number>;
  };
  responseTime: number;
}