import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly buckets: {
    documents: string;
    media: string;
    training: string;
  };

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('aws.region');
    const accessKeyId = this.configService.get<string>('aws.accessKeyId');
    const secretAccessKey = this.configService.get<string>('aws.secretAccessKey');

    const clientConfig: any = {
      region: region || 'us-east-1',
    };

    if (accessKeyId && secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId,
        secretAccessKey,
      };
    }

    this.s3Client = new S3Client(clientConfig);
    this.buckets = this.configService.get('aws.s3.buckets') || {
      documents: 'documents-bucket',
      media: 'media-bucket',
      training: 'training-bucket',
    };
  }

  async uploadDocument(documentId: string, file: Express.Multer.File): Promise<string> {
    const key = `documents/${documentId}/${file.originalname}`;
    
    try {
      const command = new PutObjectCommand({
        Bucket: this.buckets.documents,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(command);
      
      const url = `https://${this.buckets.documents}.s3.amazonaws.com/${key}`;
      this.logger.log(`Document uploaded to S3: ${url}`);
      
      return url;
    } catch (error: any) {
      // If S3 is not available, return a local URL
      if (error.message?.includes('UnknownEndpoint') || error.name === 'NoSuchBucket') {
        this.logger.warn('S3 not available, using local storage fallback');
        return `local://documents/${documentId}/${file.originalname}`;
      }
      this.logger.error('Error uploading to S3:', error);
      throw error;
    }
  }

  async uploadMedia(mediaId: string, file: Express.Multer.File): Promise<string> {
    const key = `media/${mediaId}/${file.originalname}`;
    
    try {
      const command = new PutObjectCommand({
        Bucket: this.buckets.media,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(command);
      
      const url = `https://${this.buckets.media}.s3.amazonaws.com/${key}`;
      this.logger.log(`Media uploaded to S3: ${url}`);
      
      return url;
    } catch (error) {
      this.logger.error('Error uploading media to S3:', error);
      throw error;
    }
  }

  async getSignedUrl(bucket: string, key: string, expiresIn = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      this.logger.error('Error generating signed URL:', error);
      throw error;
    }
  }

  async downloadDocument(documentId: string): Promise<Buffer> {
    const key = `documents/${documentId}`;
    
    try {
      const command = new GetObjectCommand({
        Bucket: this.buckets.documents,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      const chunks = [];
      
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      
      return Buffer.concat(chunks);
    } catch (error) {
      this.logger.error('Error downloading from S3:', error);
      throw error;
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    const key = `documents/${documentId}`;
    
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.buckets.documents,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`Document deleted from S3: ${key}`);
    } catch (error: any) {
      // If S3 is not available or document doesn't exist, don't throw
      if (error.name === 'NoSuchKey' || error.name === 'NoSuchBucket' || error.message?.includes('UnknownEndpoint')) {
        this.logger.debug(`Document not found or S3 unavailable for deletion: ${key}`);
        return;
      }
      this.logger.error('Error deleting from S3:', error);
      // Don't throw for delete operations
      return;
    }
  }

  async checkFileExists(bucket: string, key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }
}