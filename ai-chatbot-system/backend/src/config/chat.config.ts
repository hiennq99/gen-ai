export default () => ({
  chat: {
    // Exact matching configuration
    exactMatch: {
      enabled: true, // Enable exact Q&A matching
      threshold: 0.65, // Minimum similarity score for considering as document match (65%)
      priorityMode: 'qa_first', // 'qa_first' | 'ai_only' | 'hybrid'
      autoReturn: true, // Automatically return raw answer for matches above threshold
    },
    
    // Response modes
    responseMode: {
      default: 'hybrid', // 'exact' | 'ai' | 'hybrid'
      allowUserOverride: true, // Allow users to change mode
    },
    
    // AI personality configuration
    personality: {
      enabled: true,
      traits: {
        warmth: 85,
        empathy: 90,
        humor: 70,
        supportiveness: 95,
        enthusiasm: 80,
      },
      emojiUsage: {
        enabled: true,
        frequency: 'moderate', // 'low' | 'moderate' | 'high'
      },
    },
    
    // Context settings
    context: {
      maxLength: 10000,
      includeHistory: true,
      historyLimit: 5,
    },
    
    // Performance settings
    performance: {
      targetResponseTime: 5000, // milliseconds
      cacheEnabled: true,
      cacheTTL: 3600, // seconds
    },
  },
});