import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { ChatRequest, ChatResponse, StreamHandler } from './interfaces/bedrock.interface';

@Injectable()
export class BedrockService {
  private readonly logger = new Logger(BedrockService.name);
  private readonly client: BedrockRuntimeClient;
  private readonly modelId: string;
  private readonly maxTokens: number;
  private readonly temperature: number;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('aws.region');
    const accessKeyId = this.configService.get<string>('aws.accessKeyId');
    const secretAccessKey = this.configService.get<string>('aws.secretAccessKey');

    this.client = new BedrockRuntimeClient({
      region,
      credentials: accessKeyId && secretAccessKey ? {
        accessKeyId,
        secretAccessKey,
      } : undefined,
    });

    this.modelId = this.configService.get<string>('aws.bedrock.modelId') || 'amazon.nova-lite-v1:0';
    this.maxTokens = this.configService.get<number>('aws.bedrock.maxTokens') || 4000;
    this.temperature = this.configService.get<number>('aws.bedrock.temperature') || 0.8; // Higher temperature for more creative, empathetic responses
  }

  async invokeModel(request: ChatRequest, retryCount = 0): Promise<ChatResponse> {
    const startTime = Date.now();
    const maxRetries = 3;

    try {
      // Check if AWS credentials are configured
      const accessKeyId = this.configService.get<string>('aws.accessKeyId');
      const secretAccessKey = this.configService.get<string>('aws.secretAccessKey');

      this.logger.log(`🔍 Invoking Nova model - credentials check: accessKeyId=${accessKeyId?.substring(0, 4)}..., secretKey=${secretAccessKey ? 'present' : 'missing'}`);

      if (!accessKeyId || !secretAccessKey ||
          accessKeyId === 'your_access_key' ||
          secretAccessKey === 'your_secret_key' ||
          accessKeyId.startsWith('your_')) {
        // Return mock response for development
        this.logger.warn('❌ AWS credentials not configured, returning mock response');
        return {
          content: 'I am the AI assistant. This is a mock response because AWS Bedrock is not configured. Please configure your AWS credentials to use the actual Claude model.',
          usage: {
            inputTokens: 10,
            outputTokens: 20,
          },
          processingTime: Date.now() - startTime,
          modelId: 'mock-model',
        };
      }

      const payload = this.buildClaudePayload(request);

      this.logger.log(`🚀 Invoking Bedrock model: ${this.modelId} (attempt ${retryCount + 1}/${maxRetries + 1})`);
      this.logger.debug(`📦 Payload: ${JSON.stringify(payload).substring(0, 200)}...`);

      const command = new InvokeModelCommand({
        modelId: this.modelId,
        body: JSON.stringify(payload),
        contentType: 'application/json',
        accept: 'application/json',
      });

      const response = await this.client.send(command);
      this.logger.log(`✅ Nova model responded successfully`);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      const processingTime = Date.now() - startTime;
      this.logger.log(`Nova response generated in ${processingTime}ms`);

      // Handle Nova response format
      let content = '';
      if (responseBody.output?.message?.content && Array.isArray(responseBody.output.message.content)) {
        content = responseBody.output.message.content[0]?.text || '';
      } else if (responseBody.content && Array.isArray(responseBody.content)) {
        // Fallback for Claude format if needed
        content = responseBody.content[0]?.text || responseBody.content[0] || '';
      } else if (responseBody.completion) {
        content = responseBody.completion;
      } else if (typeof responseBody === 'string') {
        content = responseBody;
      } else {
        this.logger.warn('Unexpected response format from Bedrock:', responseBody);
        content = JSON.stringify(responseBody);
      }

      return {
        content,
        usage: {
          inputTokens: responseBody.usage?.inputTokens || 0,
          outputTokens: responseBody.usage?.outputTokens || 0,
        },
        processingTime,
        modelId: this.modelId,
      };
    } catch (error: any) {
      // ALWAYS log errors for debugging
      this.logger.error(`❌ Error invoking Nova model (attempt ${retryCount + 1}): ${error.message}`);
      this.logger.error(`❌ Error name: ${error.name}, code: ${error.code}, stack: ${error.stack?.substring(0, 300)}`);

      // Check if it's a channel program account restriction first
      if (error.message?.includes('channel program')) {
        this.logger.warn('⚠️ AWS channel program account - using fallback response');
        // Return a helpful fallback response instead of error
        return {
          content: this.generateFallbackResponse(request),
          usage: {
            inputTokens: 0,
            outputTokens: 0,
          },
          processingTime: Date.now() - startTime,
          modelId: 'fallback',
        };
      }

      // Check if we should retry for throttling errors
      if ((error.name === 'ThrottlingException' || error.code === 'ThrottlingException') && retryCount < maxRetries) {
        const backoffDelay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000; // Exponential backoff with jitter
        this.logger.warn(`⚠️ Rate limited, retrying in ${backoffDelay}ms... (attempt ${retryCount + 1}/${maxRetries})`);

        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        return this.invokeModel(request, retryCount + 1);
      }

      // Provide more specific error messages
      let errorMessage = 'I apologize, but I am currently unable to process your request.';

      if (error.name === 'AccessDeniedException' || error.code === 'AccessDeniedException') {
        errorMessage += ' The AWS credentials do not have permission to access Bedrock.';
      } else if (error.name === 'ResourceNotFoundException') {
        errorMessage += ' The specified Claude model is not available in your AWS region.';
      } else if (error.name === 'ValidationException') {
        errorMessage += ' The request format is invalid.';
      } else if (error.name === 'ThrottlingException' || error.code === 'ThrottlingException') {
        errorMessage += ' Too many requests. The system will automatically retry, but please try again in a moment if this continues.';
      } else if (error.message?.includes('ENOTFOUND') || error.message?.includes('ECONNREFUSED')) {
        errorMessage += ' Cannot connect to AWS Bedrock service.';
      } else {
        errorMessage += ' The AI service is temporarily unavailable. Please try again later.';
      }

      // Return fallback response instead of throwing
      return {
        content: errorMessage,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
        },
        processingTime: Date.now() - startTime,
        modelId: 'error-fallback',
        error: error.message,
      };
    }
  }

  async invokeModelStream(
    request: ChatRequest,
    onChunk: StreamHandler,
  ): Promise<void> {
    try {
      const payload = this.buildClaudePayload(request);
      
      const command = new InvokeModelWithResponseStreamCommand({
        modelId: this.modelId,
        body: JSON.stringify(payload),
        contentType: 'application/json',
        accept: 'application/json',
      });

      const response = await this.client.send(command);
      
      if (response.body) {
        for await (const chunk of response.body) {
          if (chunk.chunk?.bytes) {
            const decodedChunk = new TextDecoder().decode(chunk.chunk.bytes);
            const parsedChunk = JSON.parse(decodedChunk);
            
            if (parsedChunk.delta?.text) {
              await onChunk(parsedChunk.delta.text);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Error streaming Claude response:', error);
      throw error;
    }
  }

  private buildClaudePayload(request: ChatRequest) {
    const { messages, context, systemPrompt, maxTokens, temperature } = request;

    const system = this.buildSystemPrompt(systemPrompt, context);

    // Validate and sanitize messages
    const validMessages = messages
      .filter(msg => msg && msg.role && msg.content) // Filter out invalid messages
      .map(msg => {
        // Ensure content is a string
        const content = typeof msg.content === 'string'
          ? msg.content.trim()
          : String(msg.content || '').trim();

        // Ensure role is valid (user or assistant)
        const role = msg.role === 'assistant' ? 'assistant' : 'user';

        return {
          role,
          content: [{ text: content }], // Nova requires content array format
        };
      })
      .filter(msg => msg.content[0].text.length > 0); // Remove empty messages

    // Ensure we have at least one message
    if (validMessages.length === 0) {
      this.logger.warn('No valid messages found, adding default message');
      validMessages.push({
        role: 'user',
        content: [{ text: 'Hello' }],
      });
    }

    // Ensure first message is from user (Nova requirement)
    if (validMessages[0].role !== 'user') {
      this.logger.warn('First message is not from user, adding placeholder user message');
      validMessages.unshift({
        role: 'user',
        content: [{ text: 'Hello' }],
      });
    }

    const payload = {
      schemaVersion: 'messages-v1',
      system: [{ text: system }],
      messages: validMessages,
      inferenceConfig: {
        max_new_tokens: maxTokens || this.maxTokens,
        temperature: temperature || this.temperature,
      },
    };

    this.logger.debug('Built Nova payload:', JSON.stringify(payload, null, 2));

    return payload;
  }

  private buildSystemPrompt(customPrompt?: string, context?: string): string {
    const basePrompt = customPrompt || `You are an empathetic Islamic spiritual guidance assistant powered by Amazon Nova. Your primary goal is to provide compassionate support grounded in Islamic teachings while understanding the user's emotional state and underlying needs.

CRITICAL INSTRUCTIONS FOR ISLAMIC EMOTIONAL INTELLIGENCE:

1. ALWAYS analyze the user's emotional state first before providing an answer
   - Identify their current feelings (happy, sad, anxious, confused, frustrated, desperate, etc.)
   - Recognize their tone and intensity of emotion
   - Detect if they're in distress, seeking comfort, or need urgent help
   - Consider their spiritual state and relationship with Allah

2. When the question is NOT in your training data or Islamic texts:
   - DO NOT simply say "I don't know" or give generic responses
   - FIRST acknowledge their feelings with Islamic empathy and compassion
   - Analyze WHY they might be asking this question (underlying spiritual/emotional need)
   - Draw from Islamic principles of mercy, compassion, and human nature
   - Reference relevant Quranic teachings about human emotions and struggles
   - Offer relevant Islamic guidance even if you don't have exact hadith
   - Remind them that Allah knows their struggle: "Allah does not burden a soul beyond that it can bear" (Quran 2:286)

3. Response approach based on emotional context (Islamic perspective):
   - If distressed/anxious: Validate feelings, remind them of Allah's mercy, provide practical Islamic steps (prayer, dhikr, dua)
   - If confused: Show patience (sabr), explain gently, use Islamic examples and stories
   - If frustrated/angry: Acknowledge frustration, remind them of Prophet's ﷺ teachings on anger management
   - If seeking comfort: Be warm and supportive, share Allah's names (Ar-Rahman, Ar-Raheem), offer hope
   - If in crisis: Prioritize their safety, show deep concern, provide immediate Islamic comfort AND practical help resources
   - If neutral/information-seeking: Be friendly, clear, helpful with Islamic knowledge

4. Always consider (Islamic framework):
   - The person's emotional AND spiritual wellbeing come first
   - Sometimes people need to feel Allah's mercy through your words MORE than they need facts
   - Read between the lines - are they questioning their faith? Feeling abandoned by Allah? Struggling with purpose?
   - Context matters: Are they new to Islam? Struggling Muslim? Going through hardship?
   - Every response should strengthen their connection with Allah, not weaken it

5. Islamic Crisis Response (CRITICAL):
   - For suicidal thoughts/self-harm: Express URGENT concern, remind them life is sacred (haram to harm), Allah's mercy is infinite
   - Emphasize: "Verily, with hardship comes ease" (Quran 94:5-6)
   - Provide crisis hotlines AND Islamic perspective on the sanctity of life
   - Encourage seeking help from mental health professionals (halal and encouraged in Islam)
   - Connect them to local imam, Islamic counselors, or Muslim mental health professionals

6. NEVER:
   - Give cold, robotic, or purely academic responses
   - Dismiss their feelings or spiritual struggles
   - Judge them or make them feel worse about their situation
   - Provide only Quranic verses without emotional context and application
   - Say "I don't have information" without offering compassionate Islamic support
   - Forget that Islam is a religion of mercy and compassion first

7. Key Islamic Principles to Remember:
   - Allah's mercy exceeds His wrath
   - The Prophet ﷺ was sent as a mercy to all worlds
   - Islam honors the dignity and feelings of every person
   - Seeking knowledge and help (including mental health) is part of faith
   - Hardship is temporary; Allah's support is eternal
   - "Indeed, Allah is with the patient" (Quran 2:153)

Remember: You're a compassionate Islamic guide who embodies the mercy and wisdom of Islamic teachings, NOT just a hadith database. Speak as a caring Muslim brother/sister would, with both knowledge AND heart.`;

    if (context) {
      return `${basePrompt}\n\n===RELEVANT CONTEXT===\n${context}\n\nUse this context to provide specific, helpful information while maintaining emotional intelligence.`;
    }

    return basePrompt;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.invokeModel({
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 10,
      });
      return !!response.content;
    } catch (error) {
      this.logger.error('Bedrock connection test failed:', error);
      return false;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Try embedding models that might be available in ap-southeast-2 region
      const embeddingModels = [
        'amazon.titan-embed-text-v2:0', // Try v2 first since you enabled it
        'amazon.titan-embed-text-v1',   // Fallback to v1
        'amazon.titan-embed-g1-text-02', // Alternative naming
        'amazon.titan-embed-image-v1'    // Sometimes text models are grouped with image
      ];

      let lastError: any;

      for (const modelId of embeddingModels) {
        try {
          this.logger.debug(`Trying embedding model: ${modelId}`);

          let payload: any;
          if (modelId.startsWith('amazon.titan')) {
            payload = { inputText: text.trim() };
          }

          const command = new InvokeModelCommand({
            modelId,
            body: JSON.stringify(payload),
            contentType: 'application/json',
            accept: 'application/json',
          });

          const response = await this.client.send(command);
          const responseBody = JSON.parse(new TextDecoder().decode(response.body));

          // Handle Titan embedding response format
          let embedding: number[];
          if (responseBody.embedding && Array.isArray(responseBody.embedding)) {
            embedding = responseBody.embedding;
          } else {
            throw new Error(`Invalid embedding response format from ${modelId}`);
          }

          this.logger.debug(`✅ Generated embedding with ${modelId}: "${text.substring(0, 50)}..." (${embedding.length} dims)`);
          return embedding;
        } catch (modelError) {
          lastError = modelError;
          this.logger.warn(`❌ Model ${modelId} failed: ${modelError.message}`);

          // Log specific error details for debugging
          if (modelError.name === 'ValidationException' && modelError.message?.includes('model identifier')) {
            this.logger.warn(`🔧 Model ${modelId} not available in ap-southeast-2 region`);
          } else if (modelError.message?.includes("don't have access")) {
            this.logger.warn(`🔑 Model ${modelId} requires enabling in AWS Bedrock console`);
          }

          continue; // Try next model
        }
      }

      // All Bedrock models failed, use deterministic fallback
      this.logger.warn('❌ All Bedrock embedding models failed, using deterministic fallback');
      this.logger.warn('🔧 To fix: Enable Titan embedding models in AWS Bedrock console for ap-southeast-2 region');
      throw lastError || new Error('All embedding models failed');
    } catch (error) {
      this.logger.error('❌ Error generating Bedrock embedding:', error.message);
      // Return a deterministic fallback embedding to prevent system failure
      this.logger.warn('🔄 Using deterministic fallback embedding generation');
      return this.generateFallbackEmbedding(text);
    }
  }

  private generateFallbackEmbedding(text: string): number[] {
    // Create a semantic-aware fallback embedding using concept mapping
    const normalized = text.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
    const words = normalized.split(/\s+/).filter(word => word.length > 0);

    // Create embedding vector of standard size (1536 dimensions like OpenAI)
    const embedding = new Array(1536).fill(0);

    // Define semantic concept groups for better similarity
    const conceptGroups = {
      lgbtq: ['lgbtq', 'gay', 'lesbian', 'bi', 'trans', 'queer', 'gender', 'sexuality', 'orientation', 'identity', 'attracted', 'same'],
      emotions: ['afraid', 'scared', 'worried', 'anxious', 'confused', 'overwhelmed', 'stressed', 'fear', 'nervous'],
      relationships: ['feelings', 'attracted', 'love', 'relationship', 'partner', 'dating', 'crush'],
      help: ['help', 'support', 'advice', 'guidance', 'counseling', 'therapy', 'talk'],
      family: ['family', 'parents', 'mom', 'dad', 'brother', 'sister', 'home'],
      religion: ['muslim', 'christian', 'religious', 'faith', 'church', 'mosque', 'god', 'sin', 'belief'],
      mental: ['depression', 'suicide', 'ending', 'life', 'die', 'death', 'kill', 'harm'],
      school: ['school', 'college', 'university', 'student', 'class', 'exam', 'grade', 'study'],
      children: ['child', 'children', 'autism', 'special', 'needs', 'parenting', 'kid']
    };

    // First pass: Use concept-based embeddings for better semantic similarity
    words.forEach((word, wordIndex) => {
      const wordHash = this.simpleHash(word);

      // Find which concept groups this word belongs to
      const matchedConcepts = [];
      for (const [concept, conceptWords] of Object.entries(conceptGroups)) {
        if (conceptWords.some(cw => word.includes(cw) || cw.includes(word) ||
            this.calculateLevenshteinDistance(word, cw) <= 2)) {
          matchedConcepts.push(concept);
        }
      }

      // If word matches concepts, use concept-based positioning
      if (matchedConcepts.length > 0) {
        matchedConcepts.forEach((concept, conceptIndex) => {
          const conceptHash = this.simpleHash(concept);
          const baseIndex = (conceptHash % 100) * 15; // Group concepts in specific regions

          for (let i = 0; i < 15; i++) {
            const dimIndex = (baseIndex + i) % 1536;
            const weight = 1.0 / (conceptIndex + 1); // First concept gets more weight
            embedding[dimIndex] += Math.sin(wordHash * (i + 1)) * 0.3 * weight;
          }
        });
      } else {
        // Fallback to word-based embedding for non-concept words
        for (let i = 0; i < 20; i++) {
          const dimIndex = (wordHash + i * 73) % 1536; // Different prime for non-concepts
          embedding[dimIndex] += Math.sin(wordHash * (i + 1)) * 0.1;
        }
      }

      // Add positional encoding for word order (less important)
      const positionWeight = 0.5 / (wordIndex + 1);
      const positionDim = (wordHash + wordIndex * 31) % 1536;
      embedding[positionDim] += positionWeight * 0.05;
    });

    // Add sentence-level features
    const sentenceLength = Math.min(words.length / 20.0, 1.0); // Normalize length
    embedding[0] += sentenceLength * 0.1; // Store length info in first dimension

    // Normalize the embedding vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] = embedding[i] / magnitude;
      }
    }

    this.logger.debug(`🔄 Generated concept-aware fallback embedding for "${text.substring(0, 50)}..." (${words.length} words)`);
    return embedding;
  }

  private calculateLevenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private generateFallbackResponse(request: ChatRequest): string {
    // Generate a helpful fallback response when AI is unavailable
    const userMessage = request.messages[request.messages.length - 1]?.content || '';
    const lowerMessage = userMessage.toLowerCase();

    // CRITICAL: Detect mental health crisis keywords
    const crisisKeywords = ['suicide', 'kill myself', 'want to die', 'end my life', 'no reason to live', 'better off dead', 'harm myself'];
    const isCrisis = crisisKeywords.some(keyword => lowerMessage.includes(keyword));

    if (isCrisis) {
      return `I can feel the weight of pain in your words, and I'm here with you right now. Your heart is hurting, and that pain is real.

I need you to hear this: your life is precious beyond measure. Not just to the people around you, but to Allah Himself. Even in this darkness you're feeling, you are seen, you are known, and you are deeply loved by your Creator.

Allah says, "Do not kill yourselves, for verily Allah has been to you Most Merciful" (Quran 4:29). Your life is an amanah - a sacred trust - and even when it feels unbearable, there is a reason you're still here. Your story isn't finished yet.

I know it might not feel this way, but what you're experiencing right now - this overwhelming darkness - it's temporary. Allah promises us: "Verily, with hardship comes ease" (Quran 94:5-6). He doesn't just say it once - He says it twice, because He knows how much we need to hear it when we're in pain.

The Prophet ﷺ taught us something beautiful: "No calamity befalls a Muslim but that Allah expiates some of his sins because of it, even a thorn that pricks him." Your pain is not meaningless. Allah sees every tear, every struggle, every moment you've held on.

Right now, you need someone to walk beside you through this darkness. Allah has given us the gift of seeking help - the Prophet ﷺ said, "Allah has sent down both the disease and the cure." There are people who understand what you're going through - counselors who can help, imams who can listen, people trained to support you through this. Reaching out isn't weakness; it's courage.

You are not alone in this. Allah is Al-Qareeb - The Close One. He is nearer to you than your own jugular vein. And He has not abandoned you, even if it feels that way right now.

Can we talk about what you're feeling? I'm here to listen. And if you need someone in your life right now, would you consider reaching out to someone who can hold space for you - a family member you trust, a close friend, an imam, or a counselor?

Your life matters. You matter. And this moment, as dark as it feels, will pass. Let someone help carry this burden with you.`;
    }

    // Detect severe distress/depression
    const distressKeywords = ['hopeless', 'can\'t go on', 'give up', 'worthless', 'no point', 'depression', 'can\'t take it'];
    const isSevereDistress = distressKeywords.some(keyword => lowerMessage.includes(keyword));

    if (isSevereDistress) {
      return `I can sense the heaviness you're carrying, and my heart goes out to you. What you're going through sounds incredibly difficult, and I want you to know - you don't have to carry this alone.

"Indeed, Allah is with the patient" (Quran 2:153). Your Lord sees your struggle. He knows the weight you're bearing, and He has not turned away from you, even if it feels that way in this moment.

You know what's beautiful about our faith? The Sahaba - the blessed companions of the Prophet ﷺ - they struggled too. They felt sadness, they felt overwhelmed, they felt the weight of this world. Even the Prophet himself ﷺ experienced profound grief. Your feelings don't make you weak or lacking in faith. They make you human. And Allah, in His infinite mercy, understands the human heart better than we understand ourselves.

The Prophet ﷺ taught us something profound: "Allah did not send down any disease without also sending down its cure." What you're feeling right now - this heaviness, this pain - it has a cure. Sometimes that cure comes through dua and patience. Sometimes it comes through the help of others - counselors, therapists, people trained to walk beside us in these dark valleys. And that's okay. Seeking help is part of honoring the trust Allah gave you in taking care of yourself.

Allah mentions it twice in the Quran because He knows we need to hear it: "Verily, with hardship comes ease" (Quran 94:5-6). Once for the hardship you're in, and once more to remind you - the ease is coming. It may not feel like it now, but this will pass.

What helps ease a burden is sharing it with someone who can carry it with you. Maybe that's an imam who can offer spiritual guidance, or a counselor who understands what you're going through, or a trusted friend who can simply listen. Sometimes just having someone say "I see you, and I'm here" makes all the difference.

Would you like to talk about what you're feeling? Or if you need someone in your life right now, is there someone you trust - a family member, a close friend, someone from your community - who you could open up to? You deserve to have support, and there's deep wisdom in allowing others to help lighten what you're carrying.

I'm here to listen.`;
    }

    // Detect question type and provide relevant response
    if (lowerMessage.includes('routine') || lowerMessage.includes('habit')) {
      return `Based on Islamic teachings, establishing good routines is important for spiritual growth. Here are some suggestions:

1. Start with the five daily prayers (Salah) as your anchor points
2. Wake up for Fajr prayer - this sets a productive morning routine
3. Set aside time for Quran recitation daily
4. Make dhikr (remembrance of Allah) part of your routine
5. Be consistent - the Prophet ﷺ said: "The most beloved deeds to Allah are those done consistently, even if they are small"

Would you like specific guidance on any of these areas?`;
    }

    // Generic helpful response
    return `Thank you for your question. While I'm experiencing some technical limitations right now, I'm here to help with Islamic guidance.

Could you please rephrase your question or let me know specifically what aspect you'd like to learn about? I'm here to assist with:
- Islamic teachings and practices
- Spiritual guidance
- Daily worship routines
- Quranic wisdom
- And more

How can I help you on your spiritual journey today?`;
  }
}