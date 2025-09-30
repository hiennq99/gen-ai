import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { RedisVectorService, VectorDocument } from '../cache/redis-vector.service';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private docClient: DynamoDBDocumentClient;
  private isConfigured: boolean = false;
  private inMemoryStore: Map<string, any[]> = new Map();
  private tables: Record<string, string> & {
    conversations: string;
    documents: string;
    training: string;
    users: string;
  };

  constructor(
    private configService: ConfigService,
    private redisVectorService: RedisVectorService,
  ) {
    const region = this.configService.get<string>('aws.region');
    const accessKeyId = this.configService.get<string>('aws.accessKeyId');
    const secretAccessKey = this.configService.get<string>('aws.secretAccessKey');

    // Initialize in-memory stores
    this.inMemoryStore.set('conversations', []);
    this.inMemoryStore.set('documents', []);
    this.inMemoryStore.set('training', []);
    this.inMemoryStore.set('users', []);
    this.inMemoryStore.set('sessions', []);
    this.inMemoryStore.set('qa', []);
    this.inMemoryStore.set('training-jobs', []);

    // No hardcoded Q&A data - use vector database approach

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
        this.inMemoryStore.set('training-jobs', []);
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
      this.inMemoryStore.set('training-jobs', []);
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
      // Filter by sessionId and sort by timestamp (chronological order)
      return conversations
        .filter((c: any) => c.sessionId === sessionId)
        .sort((a: any, b: any) => {
          const timeA = new Date(a.createdAtISO || a.createdAt).getTime();
          const timeB = new Date(b.createdAtISO || b.createdAt).getTime();
          return timeA - timeB;
        });
    }

    try {
      // If sessionId is '*', return all conversations
      if (sessionId === '*') {
        return this.getAllConversations();
      }

      // Use Scan instead of Query since we're filtering by sessionId, not primary key
      // Removed Limit to get ALL messages in the session
      const command = new ScanCommand({
        TableName: this.tables.conversations,
        FilterExpression: 'sessionId = :sessionId',
        ExpressionAttributeValues: {
          ':sessionId': sessionId,
        },
      });

      const response = await this.docClient.send(command);
      const items = response.Items || [];

      // Sort by timestamp (chronological order)
      return items.sort((a: any, b: any) => {
        const timeA = new Date(a.createdAtISO || a.createdAt).getTime();
        const timeB = new Date(b.createdAtISO || b.createdAt).getTime();
        return timeA - timeB;
      });
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
        return conversations
          .filter((c: any) => c.sessionId === sessionId)
          .sort((a: any, b: any) => {
            const timeA = new Date(a.createdAtISO || a.createdAt).getTime();
            const timeB = new Date(b.createdAtISO || b.createdAt).getTime();
            return timeA - timeB;
          });
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
    try {
      // Store chunk with vector in Redis
      if (chunk.embedding && chunk.embedding.length > 0) {
        const vectorDoc: VectorDocument = {
          id: chunk.id,
          text: chunk.text,
          embedding: chunk.embedding,
          metadata: {
            ...chunk.metadata,
            documentId,
            chunkIndex: chunk.chunkIndex,
          },
        };

        await this.redisVectorService.storeVector(vectorDoc);
        this.logger.debug(`Stored vector chunk ${chunk.id} in Redis`);
      } else {
        // Fallback to in-memory store for chunks without vectors
        const chunks = this.inMemoryStore.get(`chunks-${documentId}`) || [];
        chunks.push(chunk);
        this.inMemoryStore.set(`chunks-${documentId}`, chunks);
        this.logger.debug(`Stored non-vector chunk ${chunk.id} in memory`);
      }
    } catch (error) {
      this.logger.error(`Error storing chunk ${chunk.id}:`, error);
      // Fallback to in-memory store
      const chunks = this.inMemoryStore.get(`chunks-${documentId}`) || [];
      chunks.push(chunk);
      this.inMemoryStore.set(`chunks-${documentId}`, chunks);
    }
  }

  async getDocumentChunks(documentId: string): Promise<any[]> {
    try {
      // Search for chunks by documentId metadata
      const vectorChunks = await this.redisVectorService.searchByMetadata(
        { documentId },
        1000 // High limit to get all chunks
      );

      if (vectorChunks.length > 0) {
        // Convert to expected format
        const chunks = vectorChunks.map(result => ({
          id: result.id,
          documentId,
          text: result.text,
          metadata: result.metadata,
          chunkIndex: result.metadata.chunkIndex,
        }));

        // Sort by chunk index
        chunks.sort((a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0));

        this.logger.debug(`Retrieved ${chunks.length} vector chunks for document ${documentId}`);
        return chunks;
      }

      // Fallback to in-memory store
      return this.inMemoryStore.get(`chunks-${documentId}`) || [];
    } catch (error) {
      this.logger.error(`Error getting chunks for document ${documentId}:`, error);
      // Fallback to in-memory store
      return this.inMemoryStore.get(`chunks-${documentId}`) || [];
    }
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
      if (!this.isConfigured) {
        // Use in-memory store - combine both training and qa data
        const trainingItems = this.inMemoryStore.get('training') || [];
        const qaItems = this.inMemoryStore.get('qa') || [];

        // Convert Q&A items to training format and combine with regular training data
        const combinedItems = [
          ...trainingItems,
          ...qaItems.map((qaItem: any) => ({
            ...qaItem,
            type: 'qa',
            source: 'csv_upload'
          }))
        ];

        return combinedItems;
      }

      const command = new ScanCommand({
        TableName: this.tables.training,
        Limit: query?.limit || 100,
      });

      const response = await this.docClient.send(command);
      return response.Items || [];
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        this.logger.warn('Training table does not exist yet');
        // Fall back to in-memory store
        const trainingItems = this.inMemoryStore.get('training') || [];
        const qaItems = this.inMemoryStore.get('qa') || [];

        return [
          ...trainingItems,
          ...qaItems.map((qaItem: any) => ({
            ...qaItem,
            type: 'qa',
            source: 'csv_upload'
          }))
        ];
      }
      this.logger.error('Error fetching training data:', error);
      return [];
    }
  }

  async saveQAData(qaData: any) {
    try {
      if (!this.isConfigured) {
        // Fall back to in-memory store
        const qaItems = this.inMemoryStore.get('qa') || [];
        qaItems.push(qaData);
        this.inMemoryStore.set('qa', qaItems);
        return { success: true };
      }

      const command = new PutCommand({
        TableName: this.tables.training,
        Item: {
          ...qaData,
          type: 'qa',
          createdAt: Date.now(),
          createdAtISO: new Date().toISOString(),
        },
      });

      const response = await this.docClient.send(command);
      return { success: true, response };
    } catch (error: any) {
      this.logger.error('Error saving Q&A data:', error);
      // Fall back to in-memory store on error
      const qaItems = this.inMemoryStore.get('qa') || [];
      qaItems.push(qaData);
      this.inMemoryStore.set('qa', qaItems);
      return { success: true, fallback: true };
    }
  }

  async getQAData(query?: any) {
    try {
      // PRIORITIZE DynamoDB for vector database approach
      if (this.isConfigured) {
        try {
          const command = new ScanCommand({
            TableName: this.tables.training,
            Limit: query?.limit || 1000, // Increased limit for better semantic search
          });

          const response = await this.docClient.send(command);
          // Filter for Q&A type items
          const items = response.Items || [];
          const qaItems = items.filter((item: any) => item.type === 'qa');

          if (qaItems.length > 0) {
            this.logger.log(`🔍 QA DATA: Using ${qaItems.length} DynamoDB Q&A items (vector database mode)`);
            return qaItems;
          }
        } catch (scanError: any) {
          // If table doesn't exist, continue to fallback
          if (scanError.name === 'ResourceNotFoundException') {
            this.logger.warn('Training table does not exist yet - using fallback');
          } else {
            this.logger.error('DynamoDB scan error:', scanError.message);
          }
        }
      }

      // Fallback to in-memory store only if DynamoDB fails or is not configured
      const inMemoryData = this.inMemoryStore.get('qa') || [];
      this.logger.log(`🔍 QA DATA: Using ${inMemoryData.length} in-memory Q&A items (fallback mode)`);
      return inMemoryData;
    } catch (error) {
      this.logger.error('Error fetching Q&A data:', error);
      // Last resort fallback
      return this.inMemoryStore.get('qa') || [];
    }
  }

  async deleteTrainingData(id: string) {
    const command = new DeleteCommand({
      TableName: this.tables.training,
      Key: { id },
    });
    return await this.docClient.send(command);
  }

  async clearQAData() {
    try {
      // Clear Q&A data from in-memory store
      this.inMemoryStore.set('qa', []);

      if (this.isConfigured) {
        // If using DynamoDB, scan and delete all Q&A items with type 'qa'
        const scanCommand = new ScanCommand({
          TableName: this.tables.training,
          FilterExpression: '#type = :qa_type',
          ExpressionAttributeNames: {
            '#type': 'type'
          },
          ExpressionAttributeValues: {
            ':qa_type': 'qa'
          }
        });

        try {
          const scanResponse = await this.docClient.send(scanCommand);
          const qaItems = scanResponse.Items || [];

          // Delete each Q&A item
          for (const item of qaItems) {
            const deleteCommand = new DeleteCommand({
              TableName: this.tables.training,
              Key: { id: item.id }
            });
            await this.docClient.send(deleteCommand);
          }

          this.logger.log(`Cleared ${qaItems.length} Q&A items from DynamoDB`);
        } catch (dbError: any) {
          if (dbError.name === 'ResourceNotFoundException') {
            this.logger.warn('Training table does not exist, nothing to clear in DynamoDB');
          } else {
            throw dbError;
          }
        }
      }

      this.logger.log('All Q&A training data has been cleared');
      return { success: true };
    } catch (error) {
      this.logger.error('Error clearing Q&A data:', error);
      throw error;
    }
  }

  // Training job methods
  async saveTrainingJob(jobData: any) {
    try {
      if (!this.isConfigured) {
        // Fall back to in-memory store
        const jobs = this.inMemoryStore.get('training-jobs') || [];
        jobs.push(jobData);
        this.inMemoryStore.set('training-jobs', jobs);
        return { success: true };
      }

      const command = new PutCommand({
        TableName: this.tables.training,
        Item: {
          ...jobData,
          type: 'training-job',
          createdAt: Date.now(),
          createdAtISO: new Date().toISOString(),
        },
      });

      const response = await this.docClient.send(command);
      return { success: true, response };
    } catch (error: any) {
      this.logger.error('Error saving training job:', error);
      // Fall back to in-memory store on error
      const jobs = this.inMemoryStore.get('training-jobs') || [];
      jobs.push(jobData);
      this.inMemoryStore.set('training-jobs', jobs);
      return { success: true, fallback: true };
    }
  }

  async getTrainingJobs() {
    try {
      if (!this.isConfigured) {
        // Use in-memory store
        const jobs = this.inMemoryStore.get('training-jobs') || [];
        return jobs.sort((a: any, b: any) =>
          new Date(b.startedAt || b.createdAtISO).getTime() - new Date(a.startedAt || a.createdAtISO).getTime()
        );
      }

      const command = new ScanCommand({
        TableName: this.tables.training,
        FilterExpression: '#type = :job_type',
        ExpressionAttributeNames: {
          '#type': 'type'
        },
        ExpressionAttributeValues: {
          ':job_type': 'training-job'
        }
      });

      const response = await this.docClient.send(command);
      const jobs = response.Items || [];

      // Sort by most recent first
      return jobs.sort((a: any, b: any) =>
        new Date(b.startedAt || b.createdAtISO).getTime() - new Date(a.startedAt || a.createdAtISO).getTime()
      );
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        this.logger.warn('Training table does not exist yet');
        // Fall back to in-memory store
        const jobs = this.inMemoryStore.get('training-jobs') || [];
        return jobs.sort((a: any, b: any) =>
          new Date(b.startedAt || b.createdAtISO).getTime() - new Date(a.startedAt || a.createdAtISO).getTime()
        );
      }
      this.logger.error('Error fetching training jobs:', error);
      return [];
    }
  }

  async updateTrainingJob(jobId: string, updates: any) {
    try {
      if (!this.isConfigured) {
        // Update in-memory store
        const jobs = this.inMemoryStore.get('training-jobs') || [];
        const jobIndex = jobs.findIndex((job: any) => job.id === jobId);
        if (jobIndex !== -1) {
          jobs[jobIndex] = { ...jobs[jobIndex], ...updates, updatedAt: new Date().toISOString() };
          this.inMemoryStore.set('training-jobs', jobs);
        }
        return { success: true };
      }

      const command = new UpdateCommand({
        TableName: this.tables.training,
        Key: { id: jobId },
        UpdateExpression: 'SET #status = :status, #progress = :progress, #updatedAt = :updatedAt' +
          (updates.completedAt ? ', #completedAt = :completedAt' : '') +
          (updates.stoppedAt ? ', #stoppedAt = :stoppedAt' : '') +
          (updates.recordsProcessed ? ', #recordsProcessed = :recordsProcessed' : ''),
        ExpressionAttributeNames: {
          '#status': 'status',
          '#progress': 'progress',
          '#updatedAt': 'updatedAt',
          ...(updates.completedAt && { '#completedAt': 'completedAt' }),
          ...(updates.stoppedAt && { '#stoppedAt': 'stoppedAt' }),
          ...(updates.recordsProcessed && { '#recordsProcessed': 'recordsProcessed' }),
        },
        ExpressionAttributeValues: {
          ':status': updates.status,
          ':progress': updates.progress,
          ':updatedAt': new Date().toISOString(),
          ...(updates.completedAt && { ':completedAt': updates.completedAt }),
          ...(updates.stoppedAt && { ':stoppedAt': updates.stoppedAt }),
          ...(updates.recordsProcessed && { ':recordsProcessed': updates.recordsProcessed }),
        },
      });

      await this.docClient.send(command);
      return { success: true };
    } catch (error: any) {
      this.logger.error('Error updating training job:', error);
      // Fall back to in-memory store on error
      const jobs = this.inMemoryStore.get('training-jobs') || [];
      const jobIndex = jobs.findIndex((job: any) => job.id === jobId);
      if (jobIndex !== -1) {
        jobs[jobIndex] = { ...jobs[jobIndex], ...updates, updatedAt: new Date().toISOString() };
        this.inMemoryStore.set('training-jobs', jobs);
      }
      return { success: true, fallback: true };
    }
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

  async getUserProfile(userId: string) {
    // Use in-memory storage if DynamoDB is not configured
    if (!this.isConfigured) {
      const users = this.inMemoryStore.get('users') || [];
      const user = users.find((u: any) => u.id === userId);
      
      if (!user) {
        // Create a default profile for new users
        const newUser = {
          id: userId,
          name: null,
          preferences: {
            language: 'en',
            communicationStyle: 'friendly',
            interests: [],
          },
          relationshipData: {
            firstInteraction: new Date().toISOString(),
            totalInteractions: 0,
            favoriteTopics: [],
            personalNotes: [],
          },
          createdAt: Date.now(),
        };
        users.push(newUser);
        this.inMemoryStore.set('users', users);
        return newUser;
      }
      
      return user;
    }
    
    try {
      const command = new GetCommand({
        TableName: this.tables.users,
        Key: { id: userId },
      });
      
      const response = await this.docClient.send(command);
      
      if (!response.Item) {
        // Create default profile for new user
        const newUser = {
          id: userId,
          name: null,
          preferences: {
            language: 'en',
            communicationStyle: 'friendly',
            interests: [],
          },
          relationshipData: {
            firstInteraction: new Date().toISOString(),
            totalInteractions: 0,
            favoriteTopics: [],
            personalNotes: [],
          },
          createdAt: Date.now(),
          createdAtISO: new Date().toISOString(),
        };
        
        await this.saveUser(newUser);
        return newUser;
      }
      
      return response.Item;
    } catch (error) {
      this.logger.error('Error getting user profile:', error);
      // Return a default profile on error
      return {
        id: userId,
        name: null,
        preferences: {},
        relationshipData: {},
      };
    }
  }

  async updateUserProfile(userId: string, updates: any) {
    if (!this.isConfigured) {
      const users = this.inMemoryStore.get('users') || [];
      const userIndex = users.findIndex((u: any) => u.id === userId);

      if (userIndex !== -1) {
        users[userIndex] = { ...users[userIndex], ...updates };
        this.inMemoryStore.set('users', users);
      }

      return { success: true };
    }

    try {
      const command = new UpdateCommand({
        TableName: this.tables.users,
        Key: { id: userId },
        UpdateExpression: 'SET #data = :data, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#data': 'profileData',
        },
        ExpressionAttributeValues: {
          ':data': updates,
          ':updatedAt': new Date().toISOString(),
        },
      });

      await this.docClient.send(command);
      return { success: true };
    } catch (error) {
      this.logger.error('Error updating user profile:', error);
      return { success: false, error };
    }
  }

  // Generic CRUD methods for spiritual guidance admin
  async createItem(tableName: string, item: any) {
    const tableKey = this.getTableKey(tableName);

    if (!this.isConfigured) {
      const items = this.inMemoryStore.get(tableName) || [];
      const newItem = {
        ...item,
        id: item.id || `${tableName}-${Date.now()}`,
        createdAt: Date.now(),
        createdAtISO: new Date().toISOString(),
      };
      items.push(newItem);
      this.inMemoryStore.set(tableName, items);
      return { success: true, data: newItem };
    }

    try {
      const command = new PutCommand({
        TableName: this.tables[tableKey] || tableName,
        Item: {
          ...item,
          id: item.id || `${tableName}-${Date.now()}`,
          createdAt: Date.now(),
          createdAtISO: new Date().toISOString(),
        },
      });
      const result = await this.docClient.send(command);
      return { success: true, data: result };
    } catch (error: any) {
      this.logger.error(`Error creating item in ${tableName}:`, error);
      // Fallback to in-memory
      const items = this.inMemoryStore.get(tableName) || [];
      const newItem = {
        ...item,
        id: item.id || `${tableName}-${Date.now()}`,
        createdAt: Date.now(),
        createdAtISO: new Date().toISOString(),
      };
      items.push(newItem);
      this.inMemoryStore.set(tableName, items);
      return { success: true, data: newItem };
    }
  }

  async getItem(tableName: string, id: string) {
    const tableKey = this.getTableKey(tableName);

    if (!this.isConfigured) {
      const items = this.inMemoryStore.get(tableName) || [];
      return items.find((item: any) => item.id === id);
    }

    try {
      const command = new GetCommand({
        TableName: this.tables[tableKey] || tableName,
        Key: { id },
      });
      const response = await this.docClient.send(command);
      return response.Item;
    } catch (error: any) {
      this.logger.error(`Error getting item from ${tableName}:`, error);
      // Fallback to in-memory
      const items = this.inMemoryStore.get(tableName) || [];
      return items.find((item: any) => item.id === id);
    }
  }

  async updateItem(tableName: string, id: string, updates: any) {
    const tableKey = this.getTableKey(tableName);

    if (!this.isConfigured) {
      const items = this.inMemoryStore.get(tableName) || [];
      const itemIndex = items.findIndex((item: any) => item.id === id);
      if (itemIndex !== -1) {
        items[itemIndex] = { ...items[itemIndex], ...updates, updatedAt: new Date().toISOString() };
        this.inMemoryStore.set(tableName, items);
        return { success: true, data: items[itemIndex] };
      }
      return { success: false, error: 'Item not found' };
    }

    try {
      const updateExpression = Object.keys(updates).map(key => `${key} = :${key}`).join(', ');
      const expressionAttributeValues = Object.keys(updates).reduce((acc, key) => {
        acc[`:${key}`] = updates[key];
        return acc;
      }, {} as any);

      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      const command = new UpdateCommand({
        TableName: this.tables[tableKey] || tableName,
        Key: { id },
        UpdateExpression: `SET ${updateExpression}, updatedAt = :updatedAt`,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      });

      const result = await this.docClient.send(command);
      return { success: true, data: result.Attributes };
    } catch (error: any) {
      this.logger.error(`Error updating item in ${tableName}:`, error);
      // Fallback to in-memory
      const items = this.inMemoryStore.get(tableName) || [];
      const itemIndex = items.findIndex((item: any) => item.id === id);
      if (itemIndex !== -1) {
        items[itemIndex] = { ...items[itemIndex], ...updates, updatedAt: new Date().toISOString() };
        this.inMemoryStore.set(tableName, items);
        return { success: true, data: items[itemIndex] };
      }
      return { success: false, error: 'Item not found' };
    }
  }

  async deleteItem(tableName: string, id: string) {
    const tableKey = this.getTableKey(tableName);

    if (!this.isConfigured) {
      const items = this.inMemoryStore.get(tableName) || [];
      const filteredItems = items.filter((item: any) => item.id !== id);
      this.inMemoryStore.set(tableName, filteredItems);
      return { success: true };
    }

    try {
      const command = new DeleteCommand({
        TableName: this.tables[tableKey] || tableName,
        Key: { id },
      });
      await this.docClient.send(command);
      return { success: true };
    } catch (error: any) {
      this.logger.error(`Error deleting item from ${tableName}:`, error);
      // Fallback to in-memory
      const items = this.inMemoryStore.get(tableName) || [];
      const filteredItems = items.filter((item: any) => item.id !== id);
      this.inMemoryStore.set(tableName, filteredItems);
      return { success: true };
    }
  }

  async queryItems(tableName: string, filters: any = {}) {
    const tableKey = this.getTableKey(tableName);

    if (!this.isConfigured) {
      const items = this.inMemoryStore.get(tableName) || [];
      // Apply basic filtering
      return items.filter((item: any) => {
        return Object.keys(filters).every(key => {
          if (!filters[key]) return true;
          return item[key] && item[key].toString().toLowerCase().includes(filters[key].toString().toLowerCase());
        });
      });
    }

    try {
      const command = new ScanCommand({
        TableName: this.tables[tableKey] || tableName,
        Limit: filters.limit || 100,
      });

      const response = await this.docClient.send(command);
      let items = response.Items || [];

      // Apply client-side filtering
      if (Object.keys(filters).length > 0) {
        items = items.filter((item: any) => {
          return Object.keys(filters).every(key => {
            if (!filters[key] || key === 'limit') return true;
            return item[key] && item[key].toString().toLowerCase().includes(filters[key].toString().toLowerCase());
          });
        });
      }

      return items;
    } catch (error: any) {
      this.logger.error(`Error querying items from ${tableName}:`, error);
      // Fallback to in-memory
      const items = this.inMemoryStore.get(tableName) || [];
      return items.filter((item: any) => {
        return Object.keys(filters).every(key => {
          if (!filters[key]) return true;
          return item[key] && item[key].toString().toLowerCase().includes(filters[key].toString().toLowerCase());
        });
      });
    }
  }

  private getTableKey(tableName: string): string {
    const tableMap: Record<string, string> = {
      'spiritual_diseases': 'training',
      'handbook_content': 'training',
      'training_data': 'training',
    };
    return tableMap[tableName] || 'training';
  }

  // Vector database methods using Redis
  async searchVectorSimilar(
    queryVector: number[],
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<any[]> {
    try {
      const results = await this.redisVectorService.searchSimilar(queryVector, limit, threshold);

      this.logger.debug(`Vector search returned ${results.length} results above threshold ${threshold}`);

      return results.map(result => ({
        id: result.id,
        text: result.text,
        metadata: result.metadata,
        similarity: result.score,
        documentId: result.metadata.documentId,
        chunkIndex: result.metadata.chunkIndex,
      }));
    } catch (error) {
      this.logger.error('Error performing vector similarity search:', error);
      return [];
    }
  }

  async storeVectorDocument(document: VectorDocument): Promise<void> {
    try {
      await this.redisVectorService.storeVector(document);
      this.logger.debug(`Stored vector document: ${document.id}`);
    } catch (error) {
      this.logger.error(`Error storing vector document ${document.id}:`, error);
      throw error;
    }
  }

  async getVectorDocument(id: string): Promise<VectorDocument | null> {
    try {
      return await this.redisVectorService.getVector(id);
    } catch (error) {
      this.logger.error(`Error getting vector document ${id}:`, error);
      return null;
    }
  }

  async deleteVectorDocument(id: string): Promise<void> {
    try {
      await this.redisVectorService.deleteVector(id);
      this.logger.debug(`Deleted vector document: ${id}`);
    } catch (error) {
      this.logger.error(`Error deleting vector document ${id}:`, error);
      throw error;
    }
  }

  async searchVectorsByMetadata(
    filters: Record<string, any>,
    limit: number = 10
  ): Promise<any[]> {
    try {
      const results = await this.redisVectorService.searchByMetadata(filters, limit);

      return results.map(result => ({
        id: result.id,
        text: result.text,
        metadata: result.metadata,
        similarity: result.score,
        documentId: result.metadata.documentId,
        chunkIndex: result.metadata.chunkIndex,
      }));
    } catch (error) {
      this.logger.error('Error searching vectors by metadata:', error);
      return [];
    }
  }

  async getVectorStats(): Promise<any> {
    try {
      return await this.redisVectorService.getStats();
    } catch (error) {
      this.logger.error('Error getting vector stats:', error);
      return { totalDocuments: 0 };
    }
  }

  async clearVectorDatabase(): Promise<void> {
    try {
      await this.redisVectorService.clearAll();
      this.logger.log('Cleared all vector documents from Redis');
    } catch (error) {
      this.logger.error('Error clearing vector database:', error);
      throw error;
    }
  }

  // Removed hardcoded Q&A data - now using pure vector database approach with Redis
}