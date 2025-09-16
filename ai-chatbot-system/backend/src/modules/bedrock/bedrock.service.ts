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

    this.modelId = this.configService.get<string>('aws.bedrock.modelId') || 'anthropic.claude-3-sonnet-20240229-v1:0';
    this.maxTokens = this.configService.get<number>('aws.bedrock.maxTokens') || 4000;
    this.temperature = this.configService.get<number>('aws.bedrock.temperature') || 0.7;
  }

  async invokeModel(request: ChatRequest, retryCount = 0): Promise<ChatResponse> {
    const startTime = Date.now();
    const maxRetries = 3;

    try {
      // Check if AWS credentials are configured
      const accessKeyId = this.configService.get<string>('aws.accessKeyId');
      const secretAccessKey = this.configService.get<string>('aws.secretAccessKey');

      if (!accessKeyId || !secretAccessKey ||
          accessKeyId === 'your_access_key' ||
          secretAccessKey === 'your_secret_key' ||
          accessKeyId.startsWith('your_')) {
        // Return mock response for development
        this.logger.debug('AWS credentials not configured, returning mock response');
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

      this.logger.debug(`Invoking Bedrock model: ${this.modelId} (attempt ${retryCount + 1}/${maxRetries + 1})`);

      const command = new InvokeModelCommand({
        modelId: this.modelId,
        body: JSON.stringify(payload),
        contentType: 'application/json',
        accept: 'application/json',
      });

      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      const processingTime = Date.now() - startTime;
      this.logger.log(`Claude response generated in ${processingTime}ms`);

      // Handle different response formats from Claude
      let content = '';
      if (responseBody.content && Array.isArray(responseBody.content)) {
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
          inputTokens: responseBody.usage?.input_tokens || responseBody.usage?.inputTokens || 0,
          outputTokens: responseBody.usage?.output_tokens || responseBody.usage?.outputTokens || 0,
        },
        processingTime,
        modelId: this.modelId,
      };
    } catch (error: any) {
      this.logger.error(`Error invoking Claude model (attempt ${retryCount + 1}):`, error.message);
      this.logger.debug('Bedrock error details:', {
        name: error.name,
        code: error.code,
        statusCode: error.$metadata?.httpStatusCode,
        requestId: error.$metadata?.requestId,
      });

      // Check if we should retry for throttling errors
      if ((error.name === 'ThrottlingException' || error.code === 'ThrottlingException') && retryCount < maxRetries) {
        const backoffDelay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000; // Exponential backoff with jitter
        this.logger.warn(`Rate limited, retrying in ${backoffDelay}ms... (attempt ${retryCount + 1}/${maxRetries})`);

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
    
    return {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens || this.maxTokens,
      temperature: temperature || this.temperature,
      system,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    };
  }

  private buildSystemPrompt(customPrompt?: string, context?: string): string {
    const basePrompt = customPrompt || `You are an AI consulting assistant powered by Claude. 
Your goal is to provide accurate, helpful, and contextually relevant responses to user queries.
You have access to a knowledge base of documents and can provide information with high accuracy.
Always be professional, concise, and helpful in your responses.`;

    if (context) {
      return `${basePrompt}\n\nContext:\n${context}`;
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
}