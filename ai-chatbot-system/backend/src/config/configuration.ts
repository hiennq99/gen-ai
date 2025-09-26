export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  aws: {
    region: process.env.AWS_REGION || 'ap-southeast-2',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    
    bedrock: {
      modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0',
      maxTokens: parseInt(process.env.BEDROCK_MAX_TOKENS || '4096', 10),
      temperature: parseFloat(process.env.BEDROCK_TEMPERATURE || '0.7'),
    },
    
    dynamodb: {
      tables: {
        conversations: process.env.DYNAMODB_CONVERSATIONS_TABLE || 'ai-chatbot-conversations',
        documents: process.env.DYNAMODB_DOCUMENTS_TABLE || 'ai-chatbot-documents',
        training: process.env.DYNAMODB_TRAINING_TABLE || 'ai-chatbot-training',
        users: process.env.DYNAMODB_USERS_TABLE || 'ai-chatbot-users',
      },
    },
    
    s3: {
      buckets: {
        documents: process.env.S3_DOCUMENTS_BUCKET || 'ai-chatbot-documents',
        media: process.env.S3_MEDIA_BUCKET || 'ai-chatbot-media',
        training: process.env.S3_TRAINING_BUCKET || 'ai-chatbot-training',
      },
    },
    
    sqs: {
      queues: {
        training: process.env.SQS_TRAINING_QUEUE || 'ai-chatbot-training-queue',
        documents: process.env.SQS_DOCUMENTS_QUEUE || 'ai-chatbot-documents-queue',
      },
    },
  },
  
  opensearch: {
    node: process.env.OPENSEARCH_NODE || 'http://localhost:9200',
    auth: {
      username: process.env.OPENSEARCH_USERNAME || 'admin',
      password: process.env.OPENSEARCH_PASSWORD || 'admin',
    },
    indices: {
      documents: process.env.OPENSEARCH_DOCUMENTS_INDEX || 'ai-chatbot-documents',
      conversations: process.env.OPENSEARCH_CONVERSATIONS_INDEX || 'ai-chatbot-conversations',
    },
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    ttl: parseInt(process.env.REDIS_TTL || '3600', 10),
  },
  
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  performance: {
    targetResponseTime: parseInt(process.env.TARGET_RESPONSE_TIME || '5000', 10),
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '100', 10),
    cacheEnabled: process.env.CACHE_ENABLED === 'true',
  },
  
  chat: {
    // Exact matching configuration
    exactMatch: {
      enabled: process.env.CHAT_EXACT_MATCH_ENABLED !== 'false', // Default true
      threshold: parseFloat(process.env.CHAT_EXACT_MATCH_THRESHOLD || '0.9'),
      priorityMode: process.env.CHAT_PRIORITY_MODE || 'qa_first', // 'qa_first' | 'ai_only' | 'hybrid'
      autoReturn: process.env.CHAT_AUTO_RETURN_EXACT !== 'false', // Default true
    },
    
    // Response modes
    responseMode: {
      default: process.env.CHAT_RESPONSE_MODE || 'hybrid', // 'exact' | 'ai' | 'hybrid'
      allowUserOverride: process.env.CHAT_ALLOW_MODE_OVERRIDE !== 'false',
    },
    
    // AI personality configuration
    personality: {
      enabled: process.env.CHAT_PERSONALITY_ENABLED !== 'false',
      warmth: parseInt(process.env.CHAT_PERSONALITY_WARMTH || '85', 10),
      empathy: parseInt(process.env.CHAT_PERSONALITY_EMPATHY || '90', 10),
      humor: parseInt(process.env.CHAT_PERSONALITY_HUMOR || '70', 10),
      supportiveness: parseInt(process.env.CHAT_PERSONALITY_SUPPORT || '95', 10),
      enthusiasm: parseInt(process.env.CHAT_PERSONALITY_ENTHUSIASM || '80', 10),
      emojiEnabled: process.env.CHAT_EMOJI_ENABLED !== 'false',
      emojiFrequency: process.env.CHAT_EMOJI_FREQUENCY || 'moderate',
    },
  },
});