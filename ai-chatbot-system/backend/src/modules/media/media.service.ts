import { Injectable, Logger } from '@nestjs/common';
import { EmotionType } from '../emotion/interfaces/emotion.interface';

export interface DummyMedia {
  type: 'image' | 'video' | 'document' | 'suggestion';
  url?: string;
  content?: string;
  caption?: string;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  // Dummy image URLs from free services
  private readonly dummyImages = {
    happy: [
      'https://picsum.photos/400/300?random=1',
      'https://picsum.photos/400/300?random=2',
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1574313147523-cd2b14dbd7b3?w=400&h=300&fit=crop'
    ],
    sad: [
      'https://picsum.photos/400/300?random=10&grayscale',
      'https://images.unsplash.com/photo-1493836512294-502baa1986e2?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1511593358241-7eea1f3c84e5?w=400&h=300&fit=crop'
    ],
    angry: [
      'https://images.unsplash.com/photo-1542751110-97427bbecf20?w=400&h=300&fit=crop',
      'https://picsum.photos/400/300?random=20'
    ],
    fear: [
      'https://images.unsplash.com/photo-1544725121-be3bf52e2dc8?w=400&h=300&fit=crop',
      'https://picsum.photos/400/300?random=25'
    ],
    surprise: [
      'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop',
      'https://picsum.photos/400/300?random=30'
    ],
    grateful: [
      'https://images.unsplash.com/photo-1532635270-c2e3a9cd827a?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1533827432537-70133748f5c8?w=400&h=300&fit=crop'
    ],
    confused: [
      'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=400&h=300&fit=crop',
      'https://picsum.photos/400/300?random=35'
    ],
    urgent: [
      'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=300&fit=crop',
      'https://picsum.photos/400/300?random=40'
    ],
    neutral: [
      'https://picsum.photos/400/300?random=50',
      'https://picsum.photos/400/300?random=51',
      'https://picsum.photos/400/300?random=52'
    ],
    disgust: [
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop',
      'https://picsum.photos/400/300?random=60'
    ]
  };

  // Dummy video URLs (using placeholder services)
  private readonly dummyVideos = [
    'https://sample-videos.com/zip/10/mp4/SampleVideo_360x240_1mb.mp4',
    'https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-mp4-file.mp4',
    'https://filesamples.com/samples/video/mp4/SampleVideo_720x480_1mb.mp4'
  ];

  generateDummyMedia(
    emotion: EmotionType,
    messageContent: string,
    includeMedia: boolean = true
  ): DummyMedia[] {
    if (!includeMedia) {
      return [];
    }

    const media: DummyMedia[] = [];

    // ALWAYS include at least one image at the end of responses
    media.push(this.generateDummyImage(emotion, messageContent));

    // 50% chance to add additional media (video or suggestions)
    const shouldAddMoreMedia = Math.random() > 0.5;

    if (shouldAddMoreMedia) {
      // Determine additional media types based on emotion and content
      const additionalMediaTypes = this.determineAdditionalMediaTypes(emotion, messageContent);

      for (const mediaType of additionalMediaTypes) {
        if (mediaType === 'video') {
          media.push(this.generateDummyVideo(emotion, messageContent));
        } else if (mediaType === 'suggestion') {
          media.push(...this.generateSuggestions(emotion, messageContent));
        }
      }
    }

    return media.slice(0, 3); // Limit to 3 media items per response (image + 2 additional)
  }

  private determineAdditionalMediaTypes(emotion: EmotionType, messageContent: string): string[] {
    const types: string[] = [];

    // Add videos for dynamic emotions
    if (['angry', 'fear', 'urgent', 'confused'].includes(emotion)) {
      if (Math.random() > 0.6) {
        types.push('video');
      }
    }

    // Add suggestions for help-related content
    if (messageContent.includes('?') || messageContent.includes('help') || emotion === 'confused') {
      types.push('suggestion');
    }

    // Add videos for tutorial/learning content
    if (messageContent.toLowerCase().includes('tutorial') ||
        messageContent.toLowerCase().includes('learn') ||
        messageContent.toLowerCase().includes('how to')) {
      types.push('video');
    }

    return types;
  }

  // Legacy method - keeping for backward compatibility but simplified
  private determineMediaTypes(emotion: EmotionType, messageContent: string): string[] {
    // This method is now mainly used by getMediaForContext
    // Primary media generation always starts with an image
    return ['image'];
  }

  private generateDummyImage(emotion: EmotionType, messageContent: string): DummyMedia {
    const emotionImages = this.dummyImages[emotion] || this.dummyImages.neutral;
    const randomImage = emotionImages[Math.floor(Math.random() * emotionImages.length)];

    return {
      type: 'image',
      url: randomImage,
      caption: this.generateImageCaption(emotion, messageContent)
    };
  }

  private generateDummyVideo(emotion: EmotionType, messageContent: string): DummyMedia {
    const randomVideo = this.dummyVideos[Math.floor(Math.random() * this.dummyVideos.length)];

    return {
      type: 'video',
      url: randomVideo,
      caption: this.generateVideoCaption(emotion, messageContent)
    };
  }

  private generateSuggestions(emotion: EmotionType, messageContent: string): DummyMedia[] {
    const suggestions = this.getSuggestionsForEmotion(emotion, messageContent);

    return suggestions.map(suggestion => ({
      type: 'suggestion' as const,
      content: suggestion,
      caption: 'Suggested action'
    }));
  }

  private generateImageCaption(emotion: EmotionType, messageContent: string): string {
    const captions: Record<EmotionType, string[]> = {
      happy: [
        'Here\'s something to celebrate with! 🎉',
        'Visual representation of joy',
        'Happy vibes for you!'
      ],
      sad: [
        'Here\'s a calming image to help',
        'Sometimes a peaceful scene helps',
        'Take a moment to breathe'
      ],
      angry: [
        'Here\'s something to help you focus',
        'Channel that energy positively',
        'Breathe and refocus'
      ],
      fear: [
        'Here\'s a reassuring image',
        'Calming visual to ease worries',
        'Peaceful scene for comfort'
      ],
      surprise: [
        'Capturing that moment of wonder',
        'Visual surprise for you',
        'Amazing sight to share'
      ],
      disgust: [
        'Here\'s something more pleasant',
        'Cleansing visual palette',
        'Better sight to focus on'
      ],
      grateful: [
        'Something beautiful to appreciate',
        'Gratitude in visual form',
        'Beauty to be thankful for'
      ],
      confused: [
        'Visual aid to help clarify',
        'Sometimes images help explain',
        'Here\'s a helpful illustration'
      ],
      urgent: [
        'Quick visual reference',
        'Immediate visual aid',
        'Fast help visualization'
      ],
      neutral: [
        'Here\'s a related image',
        'Visual context for our discussion',
        'Something relevant to share'
      ]
    };

    const emotionCaptions = captions[emotion] || captions.neutral;
    return emotionCaptions[Math.floor(Math.random() * emotionCaptions.length)];
  }

  private generateVideoCaption(emotion: EmotionType, messageContent: string): string {
    const captions: Record<EmotionType, string> = {
      angry: 'Calming video to help you relax',
      fear: 'Reassuring content to ease your concerns',
      urgent: 'Quick video guide for immediate help',
      confused: 'Video explanation to clarify things',
      happy: 'Celebratory video content!',
      sad: 'Comforting video to help you feel better',
      surprise: 'Amazing video content to share the wonder',
      disgust: 'Pleasant video to refresh your perspective',
      grateful: 'Heartwarming video to appreciate',
      neutral: 'Related video content'
    };

    return captions[emotion] || 'Helpful video content';
  }

  private getSuggestionsForEmotion(emotion: EmotionType, messageContent: string): string[] {
    const suggestions: Partial<Record<EmotionType, string[]>> = {
      confused: [
        'Try breaking this down into smaller steps',
        'Would you like me to explain differently?',
        'Let\'s approach this from another angle'
      ],
      angry: [
        'Take a deep breath before continuing',
        'Would you like to discuss what\'s frustrating?',
        'Let\'s find a solution together'
      ],
      sad: [
        'It\'s okay to feel this way',
        'Would talking about it help?',
        'Take your time processing this'
      ],
      urgent: [
        'Let\'s prioritize the most important part',
        'What needs immediate attention?',
        'I\'m here to help right away'
      ],
      grateful: [
        'You\'re very welcome!',
        'Happy to help anytime',
        'Is there anything else I can do?'
      ],
      happy: [
        'Let\'s keep this positive energy going!',
        'What else would you like to explore?',
        'Glad you\'re feeling good about this!'
      ],
      fear: [
        'Take your time, there\'s no rush',
        'We can work through this together',
        'Would step-by-step help ease this?'
      ],
      surprise: [
        'That is quite interesting!',
        'What would you like to know more about?',
        'Shall we explore this further?'
      ],
      disgust: [
        'Let\'s focus on something more positive',
        'Would you like to change the topic?',
        'I understand this bothers you'
      ],
      neutral: [
        'How can I help you further?',
        'What would you like to know next?',
        'Is there anything specific you need?'
      ]
    };

    const emotionSuggestions = suggestions[emotion];
    if (!emotionSuggestions) return [];

    // Return 1-2 random suggestions
    const shuffled = emotionSuggestions.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.random() > 0.5 ? 2 : 1);
  }

  // Method to get emotion-appropriate media for specific contexts
  getMediaForContext(context: string, emotion: EmotionType): DummyMedia[] {
    const lowerContext = context.toLowerCase();
    const media: DummyMedia[] = [];

    // Always start with an emotion-appropriate image
    media.push(this.generateDummyImage(emotion, context));

    // Add context-specific additional media
    if (lowerContext.includes('tutorial') || lowerContext.includes('learn') || lowerContext.includes('how to')) {
      media.push({
        type: 'video',
        url: this.dummyVideos[0],
        caption: 'Step-by-step tutorial video'
      });
    }

    // Documentation context - add additional documentation image
    if (lowerContext.includes('documentation') || lowerContext.includes('docs') || lowerContext.includes('guide')) {
      media.push({
        type: 'image',
        url: 'https://picsum.photos/400/300?random=100',
        caption: 'Documentation screenshot'
      });
    }

    // Error/Problem context - add troubleshooting image
    if (lowerContext.includes('error') || lowerContext.includes('problem') || lowerContext.includes('issue')) {
      media.push({
        type: 'image',
        url: 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=400&h=300&fit=crop',
        caption: 'Troubleshooting diagram'
      });
    }

    return media.slice(0, 3); // Limit to 3 items total
  }
}