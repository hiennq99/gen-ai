import { Injectable, Logger } from '@nestjs/common';
import { EmotionType } from '../emotion/interfaces/emotion.interface';

export interface DummyMedia {
  type: 'image' | 'video' | 'gif' | 'document' | 'suggestion';
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

  // Mock GIF URLs categorized by emotion and content type (using reliable public GIFs)
  private readonly dummyGifs: Record<string, string[]> = {
    spiritual: [
      'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExMW5wdDlwZXJ6aWVyY3N2YzNhd2xqdXAwdzhjZmM2cGxpN2duNGhidyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0MYt5jPR6QX5pnqM/giphy.gif',
      'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExeHh5ZGI1dGZ5OXZqYXNhbjVtcjA3dHY1YjN0amJoa3NoY3E1ZmZkOSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7abKhOpu0NwenH3O/giphy.gif',
      'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExbGhzZ3M1b3V1cXNydTU5aDJweDFhNW1ocTZqOGt5MWVvNTRybHZwOCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xT9IgzoKnwFNmISR8I/giphy.gif'
    ],
    calming: [
      'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExbTN0dzdxa3ptNm9mdXF6dGp4MTNxYW04YzJzcjU5aHN6OWF0bjZvaiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26u4lOMA8JKSnL9Uk/giphy.gif',
      'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExdnc1anZhYXZrZjJ0Y3U5bzJ0cXZuNzI2cXZ6cjg4cWV6bmw1M3hrNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oriO7A7bt1wsEP4cw/giphy.gif',
      'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExenp5cGFxOXJ6Y3p2c2V5bjE1bHQ2d3NkeXFveDRvNThycGV4dnM3cCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0HlHFRbmaZtBRhXG/giphy.gif'
    ],
    motivational: [
      'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExZ3IxZm1vNjF3bHk5cXZ3bjkya3htaHJ2d3pzdTBhdjl4a3U5YmdybSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7absbD7FgCKGEinC/giphy.gif',
      'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExNXUzNG5peXNtOWs3anE5dGYxemYzbmRyeGI5ZHk1ZGl6cXNzMjB3dyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26u4cqiYI30juCOGY/giphy.gif',
      'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExMzFqaXFkemZ5dnl5bjVubTRvcDZjYWtjbWp1NjB0d21hYnk3eDc3ZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l3q2K5jinAlChoCLS/giphy.gif'
    ],
    educational: [
      'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExZHNoN3MxbXA2bmN0MjdxNjhveWw3cW9majFqbGJwa2J6YW80N2Z6dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/WoWm8YzFQJg5i/giphy.gif',
      'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExcXRxcGZmeGZkOG50bWg2eG0xOWl6Y2tpZHVuOWx0NGl3bGhvbnR3ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3ohzdIuqJoo8QdKlnW/giphy.gif',
      'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExOGl0dG9nbHloN3M1aXZ2czNqZTl5MnJqM3JhdWJyNTB1OHJycGR5ayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26tn33aiTi1jkl6H6/giphy.gif'
    ],
    happy: [
      'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExczd5cW42dzg5NXI2dzZuM29rZHdjNzR0c21hM2Q5MzZrYzFrcDZnNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l1ughbsd9qXz2s9SE/giphy.gif',
      'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExaXp5NnZhaWVrd2JubWNtZnE3dGE4eXBva3Fqb3J5MDZoNXJ6NGdkZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7aCSPqXE5C6T8tBC/giphy.gif',
      'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExNXE0d2p4Z3psc2xkYXF2cHF2MjlsZWVlcXpld2F4aGNxN3pmbGdhaSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26u4hHj87jMePiO3u/giphy.gif'
    ],
    general: [
      'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExOWJ3ZTh5M3JlM3l0N29tZ3V2azY2djNkcW9mYjhtamhwa2N1MG9mYSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7qE1YN7aBOFPRw8E/giphy.gif',
      'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExYmJyOWZtdjFjZG9jb3MxeDdha3djdDNobXlyODFhOHN1czlkNTl6ZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l2JhtKtDWYNKdRpoA/giphy.gif',
      'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExd2htM3ZrZnVuNXRrZGl5ZjF2YXNpNzNyNzJpdzN1NTJoa21rZGY5YSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26BRrSvJUa0crqw4E/giphy.gif'
    ]
  };

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

    // ALWAYS include a short GIF animation at the end of responses
    media.push(this.generateDummyGif(emotion, messageContent));

    // 30% chance to add suggestions for help-related content
    const shouldAddSuggestions = Math.random() > 0.7;
    if (shouldAddSuggestions) {
      // Add suggestions for help-related content
      if (messageContent.includes('?') || messageContent.includes('help') || emotion === 'confused') {
        media.push(...this.generateSuggestions(emotion, messageContent));
      }
    }

    return media.slice(0, 3); // Limit to 3 media items per response (image + video + optional suggestion)
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
  private determineMediaTypes(_emotion: EmotionType, _messageContent: string): string[] {
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

  private generateDummyGif(emotion: EmotionType, messageContent: string): DummyMedia {
    // Determine GIF category based on emotion and content
    let gifCategory: keyof typeof this.dummyGifs = 'general';

    if (['sad', 'fear', 'angry'].includes(emotion)) {
      gifCategory = 'calming';
    } else if (['grateful', 'happy'].includes(emotion)) {
      gifCategory = 'happy';
    } else if (messageContent.toLowerCase().includes('learn') ||
               messageContent.toLowerCase().includes('how') ||
               messageContent.toLowerCase().includes('teach')) {
      gifCategory = 'educational';
    } else if (messageContent.toLowerCase().includes('pray') ||
               messageContent.toLowerCase().includes('spiritual') ||
               messageContent.toLowerCase().includes('islamic') ||
               messageContent.toLowerCase().includes('allah')) {
      gifCategory = 'spiritual';
    }

    const gifsInCategory = this.dummyGifs[gifCategory];
    const randomGif = gifsInCategory[Math.floor(Math.random() * gifsInCategory.length)];

    return {
      type: 'gif',
      url: randomGif,
      caption: this.generateGifCaption(emotion, messageContent, gifCategory)
    };
  }

  private generateDummyVideo(emotion: EmotionType, messageContent: string): DummyMedia {
    // Keep this method for backward compatibility
    return this.generateDummyGif(emotion, messageContent);
  }

  private generateSuggestions(emotion: EmotionType, messageContent: string): DummyMedia[] {
    const suggestions = this.getSuggestionsForEmotion(emotion, messageContent);

    return suggestions.map(suggestion => ({
      type: 'suggestion' as const,
      content: suggestion,
      caption: 'Suggested action'
    }));
  }

  private generateImageCaption(emotion: EmotionType, _messageContent: string): string {
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

  private generateGifCaption(emotion: EmotionType, _messageContent: string, gifCategory?: string): string {
    // If GIF category is provided, use category-specific captions
    if (gifCategory) {
      const categoryCaptions: Record<string, string> = {
        spiritual: '🤲 Peaceful spiritual GIF',
        calming: '🌿 Soothing animated GIF to relax',
        motivational: '✨ Inspiring animated GIF',
        educational: '📚 Educational GIF animation',
        happy: '😊 Joyful animated GIF',
        general: '🌟 Animated GIF'
      };
      return categoryCaptions[gifCategory] || categoryCaptions.general;
    }

    // Fallback to emotion-based captions
    const captions: Record<EmotionType, string> = {
      angry: '🌿 Calming GIF to help you relax',
      fear: '💚 Reassuring animated GIF',
      urgent: '⚡ Quick animated guide',
      confused: '💡 Clarifying GIF animation',
      happy: '🎉 Celebratory animated GIF!',
      sad: '🤗 Comforting animated GIF',
      surprise: '🌟 Amazing animated GIF',
      disgust: '🌸 Pleasant GIF to refresh your mood',
      grateful: '💝 Heartwarming animated GIF',
      neutral: '🌟 Related animated GIF'
    };

    return captions[emotion] || '🌟 Helpful animated GIF';
  }

  private generateVideoCaption(emotion: EmotionType, _messageContent: string, videoCategory?: string): string {
    // Redirect to GIF captions for consistency
    return this.generateGifCaption(emotion, _messageContent, videoCategory);
  }

  private getSuggestionsForEmotion(emotion: EmotionType, _messageContent: string): string[] {
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
      const educationalGifs = this.dummyGifs['educational'];
      media.push({
        type: 'gif',
        url: educationalGifs[0],
        caption: '📚 Educational GIF animation'
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