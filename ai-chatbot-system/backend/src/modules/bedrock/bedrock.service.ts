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
}