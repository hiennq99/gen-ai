import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private docClient: DynamoDBDocumentClient;
  private isConfigured: boolean = false;
  private inMemoryStore: Map<string, any[]> = new Map();
  private tables: {
    conversations: string;
    documents: string;
    training: string;
    users: string;
  };

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('aws.region');
    const accessKeyId = this.configService.get<string>('aws.accessKeyId');
    const secretAccessKey = this.configService.get<string>('aws.secretAccessKey');

    // Initialize in-memory stores
    this.inMemoryStore.set('conversations', []);
    this.inMemoryStore.set('documents', []);
    this.inMemoryStore.set('training', []);
    this.inMemoryStore.set('users', []);
    this.inMemoryStore.set('sessions', []);

    const clientConfig: any = {
      region: region || 'us-east-1',
    };

    if (accessKeyId && secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId,
        secretAccessKey,
      };
    }

    const client = new DynamoDBClient(clientConfig);
    this.docClient = DynamoDBDocumentClient.from(client);
    
    this.tables = this.configService.get('aws.dynamodb.tables') || {
      conversations: 'conversations',
      documents: 'documents',
      training: 'training',
      users: 'users',
    };
  }

  async onModuleInit() {
    await this.testConnection();
  }

  private async testConnection() {
    try {
      const accessKeyId = this.configService.get<string>('aws.accessKeyId');
      const secretAccessKey = this.configService.get<string>('aws.secretAccessKey');
      
      if (!accessKeyId || !secretAccessKey || 
          accessKeyId.startsWith('your_') || accessKeyId === 'undefined') {
        this.logger.warn('AWS DynamoDB credentials not configured, using in-memory storage');
        this.isConfigured = false;
        // Initialize in-memory stores
        this.inMemoryStore.set('conversations', []);
        this.inMemoryStore.set('documents', []);
        this.inMemoryStore.set('training', []);
        this.inMemoryStore.set('users', []);
        return;
      }
      
      await this.docClient.send(new ScanCommand({
        TableName: this.tables.conversations,
        Limit: 1,
      }));
      this.logger.log('DynamoDB connection established');
      this.isConfigured = true;
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        this.logger.warn(`DynamoDB table ${this.tables.conversations} does not exist`);
      } else {
        this.logger.warn('DynamoDB not available, using in-memory storage');
      }
      this.isConfigured = false;
      // Initialize in-memory stores
      this.inMemoryStore.set('conversations', []);
      this.inMemoryStore.set('documents', []);
      this.inMemoryStore.set('training', []);
      this.inMemoryStore.set('users', []);
    }
  }

  // Conversation methods
  async saveConversation(data: any) {
    // Use in-memory storage if DynamoDB is not configured
    if (!this.isConfigured) {
      const conversations = this.inMemoryStore.get('conversations') || [];
      const conversationData = {
        ...data,
        createdAt: Date.now(),
        createdAtISO: new Date().toISOString(),
      };
      conversations.push(conversationData);
      this.inMemoryStore.set('conversations', conversations);
      return { success: true, data: conversationData };
    }
    
    try {
      // Generate unique ID if not provided
      const conversationId = data.id || `${data.sessionId}-${Date.now()}`;
      
      const command = new PutCommand({
        TableName: this.tables.conversations,
        Item: {
          id: conversationId,  // DynamoDB requires 'id' as primary key
          ...data,
          createdAt: Date.now(),
          createdAtISO: new Date().toISOString(),
        },
      });
      return await this.docClient.send(command);
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException' || 
          error.message?.includes('Missing the key') ||
          error.message?.includes('parameter values were invalid')) {
        this.logger.warn('DynamoDB table issue, using in-memory storage:', error.message);
        this.isConfigured = false; // Disable DynamoDB for this session
        // Fallback to in-memory storage
        const conversations = this.inMemoryStore.get('conversations') || [];
        const conversationData = {
          ...data,
          id: `${data.sessionId}-${Date.now()}`,
          createdAt: Date.now(),
          createdAtISO: new Date().toISOString(),
        };
        conversations.push(conversationData);
        this.inMemoryStore.set('conversations', conversations);
        return { success: true, data: conversationData };
      }
      this.logger.error('Error saving conversation:', error.name, error.message || error);
      return { success: false, error: error.message };
    }
  }

  async getConversationHistory(sessionId: string) {
    // Use in-memory storage if DynamoDB is not configured
    if (!this.isConfigured) {
      const conversations = this.inMemoryStore.get('conversations') || [];
      if (sessionId === '*') {
        return conversations;
      }
      return conversations.filter((c: any) => c.sessionId === sessionId).slice(-20);
    }
    
    try {
      // If sessionId is '*', return all conversations
      if (sessionId === '*') {
        return this.getAllConversations();
      }
      
      // Use Scan instead of Query since we're filtering by sessionId, not primary key
      const command = new ScanCommand({
        TableName: this.tables.conversations,
        FilterExpression: 'sessionId = :sessionId',
        ExpressionAttributeValues: {
          ':sessionId': sessionId,
        },
        Limit: 20,
      });
      
      const response = await this.docClient.send(command);
      return response.Items || [];
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException' || 
          error.message?.includes('Query condition missed key schema') ||
          error.message?.includes('key schema element')) {
        this.logger.warn('DynamoDB table issue, using in-memory storage:', error.message);
        this.isConfigured = false; // Disable DynamoDB for this session
        // Fallback to in-memory storage
        const conversations = this.inMemoryStore.get('conversations') || [];
        if (sessionId === '*') {
          return conversations;
        }
        return conversations.filter((c: any) => c.sessionId === sessionId).slice(-20);
      }
      this.logger.error('Error fetching conversation history:', error.name, error.message || error);
      return [];
    }
  }

  async getAllConversations() {
    // Use in-memory storage if DynamoDB is not configured
    if (!this.isConfigured) {
      return this.inMemoryStore.get('conversations') || [];
    }
    
    try {
      const command = new ScanCommand({
        TableName: this.tables.conversations,
        Limit: 100,
      });
      
      const response = await this.docClient.send(command);
      return response.Items || [];
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        this.logger.warn('Conversations table does not exist yet, using in-memory storage');
        return this.inMemoryStore.get('conversations') || [];
      }
      this.logger.error('Failed to get all conversations:', error);
      return [];
    }
  }

  async createSession(session: any) {
    // Use in-memory storage if DynamoDB is not configured
    if (!this.isConfigured) {
      const sessions = this.inMemoryStore.get('sessions') || [];
      const sessionData = {
        ...session,
        type: 'session',
        createdAt: Date.now(),
        createdAtISO: new Date().toISOString(),
      };
      sessions.push(sessionData);
      this.inMemoryStore.set('sessions', sessions);
      return { success: true, data: sessionData };
    }
    
    try {
      const command = new PutCommand({
        TableName: this.tables.conversations,
        Item: {
          ...session,
          type: 'session',
          createdAt: Date.now(),
          createdAtISO: new Date().toISOString(),
        },
      });
      return await this.docClient.send(command);
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        this.logger.warn('Conversations table does not exist yet, using in-memory storage');
        const sessions = this.inMemoryStore.get('sessions') || [];
        const sessionData = {
          ...session,
          type: 'session',
          createdAt: Date.now(),
          createdAtISO: new Date().toISOString(),
        };
        sessions.push(sessionData);
        this.inMemoryStore.set('sessions', sessions);
        return { success: true, data: sessionData };
      }
      throw error;
    }
  }

  async endSession(sessionId: string) {
    // Use in-memory storage if DynamoDB is not configured
    if (!this.isConfigured) {
      const sessions = this.inMemoryStore.get('sessions') || [];
      const sessionIndex = sessions.findIndex((s: any) => s.sessionId === sessionId);
      if (sessionIndex !== -1) {
        sessions[sessionIndex].endTime = new Date().toISOString();
        sessions[sessionIndex].status = 'ended';
        this.inMemoryStore.set('sessions', sessions);
      }
      return { success: true };
    }
    
    try {
      const command = new UpdateCommand({
        TableName: this.tables.conversations,
        Key: { sessionId },
        UpdateExpression: 'SET endTime = :endTime, #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':endTime': new Date().toISOString(),
          ':status': 'ended',
        },
      });
      return await this.docClient.send(command);
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        this.logger.warn('Conversations table does not exist yet, using in-memory storage');
        const sessions = this.inMemoryStore.get('sessions') || [];
        const sessionIndex = sessions.findIndex((s: any) => s.sessionId === sessionId);
        if (sessionIndex !== -1) {
          sessions[sessionIndex].endTime = new Date().toISOString();
          sessions[sessionIndex].status = 'ended';
          this.inMemoryStore.set('sessions', sessions);
        }
        return { success: true };
      }
      this.logger.error('Error ending session:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Document methods
  async saveDocument(document: any) {
    const command = new PutCommand({
      TableName: this.tables.documents,
      Item: {
        ...document,
        createdAt: Date.now(), // Use timestamp for DynamoDB Number type
        createdAtISO: new Date().toISOString(), // Keep ISO string for display
      },
    });
    return await this.docClient.send(command);
  }

  async getDocument(documentId: string) {
    const command = new GetCommand({
      TableName: this.tables.documents,
      Key: { id: documentId },
    });
    
    const response = await this.docClient.send(command);
    return response.Item;
  }

  async listDocuments(options?: any) {
    try {
      const command = new ScanCommand({
        TableName: this.tables.documents,
        Limit: options?.limit || 100,
      });
      
      const response = await this.docClient.send(command);
      return response.Items || [];
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        this.logger.warn('Documents table does not exist yet');
        return [];
      }
      this.logger.error('Error listing documents:', error);
      return [];
    }
  }

  async getAllDocuments() {
    try {
      // Try DynamoDB first if configured
      if (this.isConfigured) {
        const command = new ScanCommand({
          TableName: this.tables.documents,
        });
        
        const response = await this.docClient.send(command);
        return response.Items || [];
      }
      
      // Fall back to in-memory store
      return this.inMemoryStore.get('documents') || [];
    } catch (error: any) {
      // Fall back to in-memory store on error
      this.logger.debug('Using in-memory store for documents');
      return this.inMemoryStore.get('documents') || [];
    }
  }

  async saveDocumentChunk(documentId: string, chunk: any) {
    // Store chunks in in-memory store to avoid DynamoDB size limits
    const chunks = this.inMemoryStore.get(`chunks-${documentId}`) || [];
    chunks.push(chunk);
    this.inMemoryStore.set(`chunks-${documentId}`, chunks);
  }

  async getDocumentChunks(documentId: string): Promise<any[]> {
    return this.inMemoryStore.get(`chunks-${documentId}`) || [];
  }

  async updateDocumentStatus(documentId: string, status: string, metadata?: any) {
    const command = new UpdateCommand({
      TableName: this.tables.documents,
      Key: { id: documentId },
      UpdateExpression: 'SET #status = :status, processedAt = :processedAt, metadata = :metadata',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':processedAt': new Date().toISOString(),
        ':metadata': metadata || {},
      },
    });
    return await this.docClient.send(command);
  }

  async deleteDocument(documentId: string) {
    const command = new DeleteCommand({
      TableName: this.tables.documents,
      Key: { id: documentId },
    });
    return await this.docClient.send(command);
  }

  // Training data methods
  async saveTrainingData(data: any) {
    const command = new PutCommand({
      TableName: this.tables.training,
      Item: {
        ...data,
        id: data.id || `training-${Date.now()}`,
        createdAt: Date.now(),
        createdAtISO: new Date().toISOString(),
      },
    });
    return await this.docClient.send(command);
  }

  async getTrainingData(query?: any) {
    try {
      const command = new ScanCommand({
        TableName: this.tables.training,
        Limit: query?.limit || 100,
      });
      
      const response = await this.docClient.send(command);
      return response.Items || [];
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        this.logger.warn('Training table does not exist yet');
        return [];
      }
      this.logger.error('Error fetching training data:', error);
      return [];
    }
  }

  async getQAData(query?: any) {
    try {
      // Check if table exists first
      const command = new ScanCommand({
        TableName: this.tables.training,
        Limit: query?.limit || 100,
      });
      
      try {
        const response = await this.docClient.send(command);
        // Filter for Q&A type items
        const items = response.Items || [];
        return items.filter((item: any) => item.type === 'qa');
      } catch (scanError: any) {
        // If table doesn't exist, return empty array
        if (scanError.name === 'ResourceNotFoundException') {
          this.logger.warn('Training table does not exist yet');
          return [];
        }
        throw scanError;
      }
    } catch (error) {
      this.logger.error('Error fetching Q&A data:', error);
      return [];
    }
  }

  async deleteTrainingData(id: string) {
    const command = new DeleteCommand({
      TableName: this.tables.training,
      Key: { id },
    });
    return await this.docClient.send(command);
  }

  // User methods
  async saveUser(user: any) {
    const command = new PutCommand({
      TableName: this.tables.users,
      Item: {
        ...user,
        createdAt: Date.now(),
        createdAtISO: new Date().toISOString(),
      },
    });
    return await this.docClient.send(command);
  }

  async getUser(userId: string) {
    const command = new GetCommand({
      TableName: this.tables.users,
      Key: { id: userId },
    });
    
    const response = await this.docClient.send(command);
    return response.Item;
  }
}