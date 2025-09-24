import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../cache/cache.service';
import {
  SpiritualDisease,
  DirectQuote,
  CitationMatch,
  EmotionalState,
  ResponseTemplate,
} from './interfaces/spiritual-guidance.interface';

@Injectable()
export class CitationService {
  private readonly logger = new Logger(CitationService.name);
  private readonly spiritualDiseases: Map<string, SpiritualDisease> = new Map();
  private readonly responseTemplates: Map<string, ResponseTemplate> = new Map();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cacheService: CacheService,
  ) {
    this.initializeSpiritualDiseases();
    this.initializeResponseTemplates();
  }

  private initializeSpiritualDiseases() {
    const diseases: SpiritualDisease[] = [
      {
        name: 'Anger',
        arabicName: 'الغضب',
        pageRange: '30-42',
        emotionalTriggers: ['frustrated', 'furious', 'rage', 'annoyed', 'angry', 'mad', 'irritated'],
        directQuotes: [
          {
            page: 32,
            quote: 'Due to your anger, and that of another, a quarrel is stirred and heated to the point of conflict',
            context: 'symptoms'
          },
          {
            page: 33,
            quote: 'You repel or keep your anger under control by recognising that nothing takes place without the leave of Allah',
            context: 'treatment'
          }
        ],
        quranicEvidence: [
          {
            page: 32,
            verse: 'Be moderate in your pace. And lower your voice, for the ugliest of all voices is certainly the braying of donkeys',
            reference: 'Luqman 31:19-20'
          }
        ],
        hadithEvidence: [
          {
            page: 32,
            hadith: 'Do not become angry',
            source: 'Sahih Al-Bukhari 6116'
          }
        ]
      },
      {
        name: 'Envy',
        arabicName: 'الحسد',
        pageRange: '80-87',
        emotionalTriggers: ['jealous', 'envious', 'why do they', 'not fair', 'I wish I had', 'they have everything'],
        directQuotes: [
          {
            page: 82,
            quote: 'Envy is a fire that burns the good deeds as fire burns wood',
            context: 'symptoms'
          },
          {
            page: 84,
            quote: 'The remedy for envy is to constantly remember that Allah distributes His bounties according to His wisdom',
            context: 'treatment'
          }
        ],
        quranicEvidence: [
          {
            page: 83,
            verse: 'And do not wish for that by which Allah has made some of you exceed others',
            reference: 'An-Nisa 4:32'
          }
        ],
        hadithEvidence: [
          {
            page: 82,
            hadith: 'Beware of envy because envy devours good deeds just as fire devours wood',
            source: 'Abu Dawud 4903'
          }
        ]
      },
      {
        name: 'Hard-heartedness',
        arabicName: 'قسوة القلب',
        pageRange: '133-143',
        emotionalTriggers: ['empty', 'nothing matters', 'lost motivation', 'numb', 'disconnected', 'hopeless'],
        directQuotes: [
          {
            page: 135,
            quote: 'The heart becomes hard when it is distant from the remembrance of Allah and overwhelmed by worldly concerns',
            context: 'symptoms'
          },
          {
            page: 138,
            quote: 'Soften your heart through frequent recitation of the Quran and remembrance of death',
            context: 'treatment'
          }
        ],
        quranicEvidence: [
          {
            page: 136,
            verse: 'Then your hearts became hardened after that, being like stones or even harder',
            reference: 'Al-Baqarah 2:74'
          }
        ],
        hadithEvidence: [
          {
            page: 137,
            hadith: 'Remember often the destroyer of pleasures - death',
            source: 'Tirmidhi 2307'
          }
        ]
      }
    ];

    diseases.forEach(disease => {
      this.spiritualDiseases.set(disease.name.toLowerCase(), disease);
    });
  }

  private initializeResponseTemplates() {
    const templates: ResponseTemplate[] = [
      {
        name: 'perfect_match',
        level: 'perfect_match',
        template: `I can sense the {emotion} in your words. The Handbook of Spiritual Medicine directly addresses this as '{arabicName}' ({englishName}). On page {page}, it explains:

"{quote}"

In your situation, this means {application}. The Handbook suggests {treatment}. As mentioned on page {treatmentPage}: "{treatmentQuote}"`
      },
      {
        name: 'related_theme',
        level: 'related_theme',
        template: `What you're describing - {behaviorPattern} - is something the Handbook discusses in detail. Page {page} states:

"{quote}"

The document explains this typically happens because {cause}. The recommended approach, as outlined on page {treatmentPage}, is: "{treatmentQuote}"`
      },
      {
        name: 'general_guidance',
        level: 'general_guidance',
        template: `Your situation reminds me of the wisdom shared in the Handbook's chapter on {topic}. While not identical to your case, page {page} offers relevant guidance:

"{quote}"

Applying this to your circumstances suggests {advice}. The Handbook emphasizes on page {supportPage}: "{supportQuote}"`
      },
      {
        name: 'no_direct_match',
        level: 'no_direct_match',
        template: `The Handbook doesn't specifically address this exact situation. However, based on what you've shared earlier about {context}, and considering the overall principles of spiritual wellness discussed throughout the document, {response}.

If you'd like, I can share what the Handbook says about {relatedTopic} which might offer some relevant insights.`
      }
    ];

    templates.forEach(template => {
      this.responseTemplates.set(template.name, template);
    });
  }

  async findCitationMatch(emotionalState: EmotionalState, message: string): Promise<CitationMatch> {
    const cacheKey = `citation:${JSON.stringify(emotionalState)}:${message.slice(0, 50)}`;

    try {
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === 'string') {
        return JSON.parse(cached);
      }
    } catch (error) {
      this.logger.warn('Cache miss for citation match', error);
    }

    const match = this.performCitationMatch(emotionalState, message);

    // Cache for 1 hour
    try {
      await this.cacheService.set(cacheKey, JSON.stringify(match), 3600);
    } catch (error) {
      this.logger.warn('Failed to cache citation match', error);
    }

    return match;
  }

  private performCitationMatch(emotionalState: EmotionalState, message: string): CitationMatch {
    const primaryEmotion = emotionalState.primaryEmotion.toLowerCase();
    const messageLower = message.toLowerCase();

    // Level 1: Perfect Match - Direct emotion to spiritual disease mapping
    for (const [key, disease] of this.spiritualDiseases) {
      if (disease.emotionalTriggers.some(trigger =>
        messageLower.includes(trigger) || primaryEmotion.includes(trigger)
      )) {
        return {
          level: 'perfect_match',
          spiritualDisease: disease,
          relevantQuotes: disease.directQuotes,
          confidence: 0.9
        };
      }
    }

    // Level 2: Related Theme - Semantic similarity
    for (const [key, disease] of this.spiritualDiseases) {
      const semanticMatch = this.calculateSemanticSimilarity(
        emotionalState,
        message,
        disease
      );

      if (semanticMatch > 0.6) {
        return {
          level: 'related_theme',
          spiritualDisease: disease,
          relevantQuotes: disease.directQuotes.filter(q => q.context === 'symptoms' || q.context === 'treatment'),
          confidence: semanticMatch
        };
      }
    }

    // Level 3: General Guidance - Find most relevant quotes
    const generalQuotes = this.findMostRelevantQuotes(message, emotionalState);
    if (generalQuotes.length > 0) {
      return {
        level: 'general_guidance',
        relevantQuotes: generalQuotes,
        confidence: 0.4
      };
    }

    // Level 4: No Direct Match
    return {
      level: 'no_direct_match',
      relevantQuotes: [],
      confidence: 0.1
    };
  }

  private calculateSemanticSimilarity(
    emotionalState: EmotionalState,
    message: string,
    disease: SpiritualDisease
  ): number {
    let score = 0;
    const words = message.toLowerCase().split(' ');

    // Check for partial trigger matches
    disease.emotionalTriggers.forEach(trigger => {
      const triggerWords = trigger.split(' ');
      const matchingWords = triggerWords.filter(tw =>
        words.some(w => w.includes(tw) || tw.includes(w))
      );
      score += (matchingWords.length / triggerWords.length) * 0.3;
    });

    // Check emotional intensity alignment
    if (emotionalState.intensity > 0.7 && disease.name === 'Anger') score += 0.2;
    if (emotionalState.intensity > 0.5 && disease.name === 'Envy') score += 0.2;
    if (emotionalState.intensity < 0.3 && disease.name === 'Hard-heartedness') score += 0.2;

    return Math.min(score, 1.0);
  }

  private findMostRelevantQuotes(message: string, emotionalState: EmotionalState): DirectQuote[] {
    const allQuotes: DirectQuote[] = [];

    this.spiritualDiseases.forEach(disease => {
      allQuotes.push(...disease.directQuotes);
    });

    // Sort by relevance (simple keyword matching for now)
    const relevantQuotes = allQuotes.filter(quote => {
      const words = message.toLowerCase().split(' ');
      const quoteWords = quote.quote.toLowerCase().split(' ');

      const commonWords = words.filter(word =>
        word.length > 3 && quoteWords.some(qw => qw.includes(word))
      );

      return commonWords.length > 0;
    });

    return relevantQuotes.slice(0, 3); // Return top 3 most relevant
  }

  getResponseTemplate(level: CitationMatch['level']): ResponseTemplate | null {
    return this.responseTemplates.get(level) || null;
  }

  getAllSpiritualDiseases(): SpiritualDisease[] {
    return Array.from(this.spiritualDiseases.values());
  }

  getSpiritualDiseaseByName(name: string): SpiritualDisease | null {
    return this.spiritualDiseases.get(name.toLowerCase()) || null;
  }
}