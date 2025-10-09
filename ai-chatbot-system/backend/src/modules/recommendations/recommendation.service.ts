import { Injectable, Logger } from '@nestjs/common';
import { SearchService } from '../search/search.service';
import { DatabaseService } from '../database/database.service';

interface Recommendation {
  type: 'video' | 'article' | 'past_answer' | 'document';
  title: string;
  description?: string;
  url?: string;
  thumbnail?: string;
  relevanceScore: number;
  emotion?: string;
  tags?: string[];
  source?: string;
}

interface RecommendationRequest {
  query: string;
  emotion?: string;
  keywords?: string[];
  limit?: number;
}

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  // Curated resources database
  private readonly resources = {
    videos: [
      {
        title: 'How to Deal with Sadness in Islam',
        url: 'https://www.youtube.com/watch?v=example1',
        thumbnail: 'https://img.youtube.com/vi/example1/0.jpg',
        keywords: ['sad', 'sadness', 'depression', 'grief'],
        emotions: ['sad', 'depressed'],
        description: 'Islamic guidance on dealing with sadness and maintaining faith during difficult times'
      },
      {
        title: 'Anxiety Relief Through Islamic Practices',
        url: 'https://www.youtube.com/watch?v=example2',
        thumbnail: 'https://img.youtube.com/vi/example2/0.jpg',
        keywords: ['anxiety', 'stress', 'worry', 'fear', 'nervous'],
        emotions: ['anxious', 'fear', 'stressed'],
        description: 'Learn Islamic methods to calm anxiety and find inner peace'
      },
      {
        title: 'Anger Management in Islam',
        url: 'https://www.youtube.com/watch?v=example3',
        thumbnail: 'https://img.youtube.com/vi/example3/0.jpg',
        keywords: ['angry', 'anger', 'mad', 'frustrated', 'irritated'],
        emotions: ['angry', 'frustrated'],
        description: 'Islamic teachings on controlling anger and maintaining patience'
      },
      {
        title: 'Finding Gratitude in Daily Life',
        url: 'https://www.youtube.com/watch?v=example4',
        thumbnail: 'https://img.youtube.com/vi/example4/0.jpg',
        keywords: ['grateful', 'gratitude', 'thankful', 'blessing', 'alhamdulillah'],
        emotions: ['grateful', 'happy'],
        description: 'Developing a mindset of gratitude through Islamic perspective'
      },
      {
        title: 'Understanding Emotions in Islam',
        url: 'https://www.youtube.com/watch?v=example5',
        thumbnail: 'https://img.youtube.com/vi/example5/0.jpg',
        keywords: ['emotion', 'feeling', 'heart', 'mental health'],
        emotions: ['neutral', 'confused'],
        description: 'Islamic perspective on understanding and managing emotions'
      }
    ],
    articles: [
      {
        title: 'Islamic Guidance on Mental Health',
        url: 'https://islamicresource.com/mental-health',
        keywords: ['mental health', 'wellbeing', 'psychology', 'health'],
        emotions: ['all'],
        description: 'Comprehensive guide on maintaining mental health from Islamic perspective'
      },
      {
        title: 'Dua for Emotional Healing',
        url: 'https://islamicresource.com/dua-healing',
        keywords: ['dua', 'prayer', 'healing', 'recover', 'cure'],
        emotions: ['sad', 'anxious', 'sick'],
        description: 'Collection of authentic duas for emotional and spiritual healing'
      },
      {
        title: 'Patience and Perseverance (Sabr) in Islam',
        url: 'https://islamicresource.com/sabr',
        keywords: ['patience', 'sabr', 'perseverance', 'endurance', 'difficulty'],
        emotions: ['sad', 'frustrated', 'tired'],
        description: 'Understanding the concept of Sabr and how to practice it'
      }
    ]
  };

  constructor(
    private readonly searchService: SearchService,
    private readonly databaseService: DatabaseService,
  ) {}

  async getRecommendations(request: RecommendationRequest): Promise<Recommendation[]> {
    const { query, emotion, keywords, limit = 5 } = request;
    const recommendations: Recommendation[] = [];

    this.logger.log(`<� Getting recommendations for: "${query}" with emotion: ${emotion}`);

    try {
      // 1. Get related videos
      const videos = this.getRelatedVideos(query, emotion, keywords);
      recommendations.push(...videos);

      // 2. Get related articles
      const articles = this.getRelatedArticles(query, emotion, keywords);
      recommendations.push(...articles);

      // 3. Get similar past answers from database
      const pastAnswers = await this.getSimilarPastAnswers(query, emotion);
      recommendations.push(...pastAnswers);

      // 4. Get related documents from search
      const relatedDocs = await this.getRelatedDocuments(query, emotion);
      recommendations.push(...relatedDocs);

      // Sort by relevance score and return top N
      const sortedRecommendations = recommendations
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);

      this.logger.log(` Found ${sortedRecommendations.length} recommendations`);

      return sortedRecommendations;
    } catch (error) {
      this.logger.error('Error getting recommendations:', error);
      return [];
    }
  }

  private getRelatedVideos(query: string, emotion?: string, keywords?: string[]): Recommendation[] {
    const queryLower = query.toLowerCase();
    const allKeywords = [...(keywords || []), ...(emotion ? [emotion] : [])];

    return this.resources.videos
      .map(video => {
        // Calculate relevance score
        let score = 0;

        // Check emotion match
        if (emotion && video.emotions.includes(emotion)) {
          score += 40;
        }

        // Check keyword match
        const matchedKeywords = video.keywords.filter(kw =>
          queryLower.includes(kw.toLowerCase()) ||
          allKeywords.some(k => k.toLowerCase().includes(kw.toLowerCase()))
        );
        score += matchedKeywords.length * 15;

        // Check query terms in title/description
        const queryWords = queryLower.split(' ');
        const titleLower = video.title.toLowerCase();
        const descLower = (video.description || '').toLowerCase();
        queryWords.forEach(word => {
          if (word.length > 3) {
            if (titleLower.includes(word)) score += 10;
            if (descLower.includes(word)) score += 5;
          }
        });

        return {
          type: 'video' as const,
          title: video.title,
          description: video.description,
          url: video.url,
          thumbnail: video.thumbnail,
          relevanceScore: Math.min(score, 100),
          emotion,
          tags: video.keywords,
          source: 'YouTube'
        };
      })
      .filter(rec => rec.relevanceScore > 20); // Only return if relevant
  }

  private getRelatedArticles(query: string, emotion?: string, keywords?: string[]): Recommendation[] {
    const queryLower = query.toLowerCase();
    const allKeywords = [...(keywords || []), ...(emotion ? [emotion] : [])];

    return this.resources.articles
      .map(article => {
        let score = 0;

        // Check emotion match
        if (emotion && (article.emotions.includes('all') || article.emotions.includes(emotion))) {
          score += 40;
        }

        // Check keyword match
        const matchedKeywords = article.keywords.filter(kw =>
          queryLower.includes(kw.toLowerCase()) ||
          allKeywords.some(k => k.toLowerCase().includes(kw.toLowerCase()))
        );
        score += matchedKeywords.length * 15;

        // Check query terms
        const queryWords = queryLower.split(' ');
        const titleLower = article.title.toLowerCase();
        const descLower = (article.description || '').toLowerCase();
        queryWords.forEach(word => {
          if (word.length > 3) {
            if (titleLower.includes(word)) score += 10;
            if (descLower.includes(word)) score += 5;
          }
        });

        return {
          type: 'article' as const,
          title: article.title,
          description: article.description,
          url: article.url,
          relevanceScore: Math.min(score, 100),
          emotion,
          tags: article.keywords,
          source: 'Islamic Resource'
        };
      })
      .filter(rec => rec.relevanceScore > 20);
  }

  private async getSimilarPastAnswers(query: string, emotion?: string): Promise<Recommendation[]> {
    try {
      // Search for similar questions in conversation history
      const conversations = await this.databaseService.getConversationHistory('*');

      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(' ').filter(w => w.length > 3);

      return conversations
        .map((conv: any) => {
          const userMessageLower = (conv.userMessage || '').toLowerCase();
          let score = 0;

          // Check query word matches
          queryWords.forEach(word => {
            if (userMessageLower.includes(word)) {
              score += 15;
            }
          });

          // Check emotion match
          if (emotion && conv.emotion?.primaryEmotion === emotion) {
            score += 30;
          }

          // Boost if high confidence original answer
          if (conv.emotion?.confidence > 80) {
            score += 10;
          }

          if (score < 20) return null;

          return {
            type: 'past_answer' as const,
            title: conv.userMessage?.substring(0, 80) + '...',
            description: conv.assistantMessage?.substring(0, 150) + '...',
            relevanceScore: Math.min(score, 100),
            emotion: conv.emotion?.primaryEmotion,
            source: 'Past Conversation',
          } as Recommendation;
        })
        .filter((rec): rec is Recommendation => rec !== null)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 3); // Top 3 past answers

    } catch (error) {
      this.logger.error('Error getting past answers:', error);
      return [];
    }
  }

  private async getRelatedDocuments(query: string, emotion?: string): Promise<Recommendation[]> {
    try {
      // Use search service to find related documents
      const searchResults = await this.searchService.searchDocuments({
        query,
        emotion,
        limit: 3,
        minScore: 0.3,
      });

      return searchResults
        .filter((doc: any) => doc.score > 0.3)
        .map((doc: any) => {
          // Calculate relevance score based on document match quality
          // OpenSearch scores can range from 0 to infinity (based on TF-IDF)
          // Normalize OpenSearch score to 0-100 range
          // Common ranges: 0-1 (poor), 1-5 (medium), 5-10 (good), 10+ (excellent)
          let relevanceScore = 0;

          if (doc.score >= 10) {
            relevanceScore = 95 + Math.min((doc.score - 10) / 10, 1) * 5; // 10+ → 95-100
          } else if (doc.score >= 5) {
            relevanceScore = 80 + ((doc.score - 5) / 5) * 15; // 5-10 → 80-95
          } else if (doc.score >= 1) {
            relevanceScore = 50 + ((doc.score - 1) / 4) * 30; // 1-5 → 50-80
          } else {
            relevanceScore = doc.score * 50; // 0-1 → 0-50
          }

          return {
            type: 'document' as const,
            title: doc.metadata?.documentName || doc.title || 'Related Document',
            description: (doc.content || doc.text || '').substring(0, 150) + '...',
            relevanceScore: Math.round(Math.min(relevanceScore, 100)),
            emotion,
            tags: doc.metadata?.tags || [],
            source: doc.metadata?.documentType || 'Document',
          };
        });
    } catch (error) {
      this.logger.error('Error getting related documents:', error);
      return [];
    }
  }
}
