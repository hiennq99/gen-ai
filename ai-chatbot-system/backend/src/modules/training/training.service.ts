import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { QueueService } from '../queue/queue.service';
import { DocumentsService } from '../documents/documents.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TrainingService {
  private readonly logger = new Logger(TrainingService.name);
  private trainingJobs: any[] = [];

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly queueService: QueueService,
    private readonly documentsService: DocumentsService,
  ) {}

  async startTraining(trainingData: any) {
    try {
      const jobId = `job-${uuidv4().substring(0, 8)}`;
      
      // Log training parameters
      this.logger.log(`Starting training job ${jobId} with parameters:`, {
        type: trainingData.type,
        documentsCount: trainingData.documents?.length || 0,
        parameters: trainingData.parameters,
      });
      
      // Create new training job
      const newJob = {
        id: jobId,
        type: trainingData.type || 'Document Training',
        name: trainingData.name || 'Unnamed Job',
        description: trainingData.description || '',
        documents: trainingData.documents || [],
        status: 'running',
        progress: 0,
        startedAt: new Date().toISOString(),
        recordsProcessed: 0,
        parameters: trainingData.parameters || {},
      };
      
      // Add to jobs list
      this.trainingJobs.push(newJob);
      
      // Simulate training progress
      this.simulateTrainingProgress(jobId);
      
      // Queue training job for actual processing
      await this.queueService.sendMessage('training', {
        type: 'training-job',
        jobId,
        data: trainingData,
        timestamp: new Date().toISOString(),
      }).catch(error => {
        this.logger.warn('Queue service not available, continuing without queue:', error.message);
      });

      return {
        jobId,
        status: 'started',
        message: 'Training job has been started',
      };
    } catch (error) {
      this.logger.error('Error starting training:', error);
      throw error;
    }
  }
  
  private simulateTrainingProgress(jobId: string) {
    // Simulate training progress over time
    const interval = setInterval(() => {
      const job = this.trainingJobs.find(j => j.id === jobId);
      if (job) {
        if (job.progress < 100) {
          job.progress += Math.random() * 15;
          job.recordsProcessed += Math.floor(Math.random() * 10);
          
          if (job.progress >= 100) {
            job.progress = 100;
            job.status = 'completed';
            job.completedAt = new Date().toISOString();
            clearInterval(interval);
          }
        }
      } else {
        clearInterval(interval);
      }
    }, 5000); // Update every 5 seconds
  }

  async processTrainingJob(job: any) {
    try {
      // Process training data
      const { data } = job;
      
      // Save training data
      await this.databaseService.saveTrainingData({
        ...data,
        status: 'completed',
        processedAt: new Date().toISOString(),
      });

      return {
        status: 'completed',
        jobId: job.id,
      };
    } catch (error) {
      this.logger.error('Error processing training job:', error);
      throw error;
    }
  }

  async getTrainingStatus(jobId: string) {
    // Implementation for getting training status
    return {
      jobId,
      status: 'in_progress',
      progress: 50,
    };
  }

  async getTrainingData(query?: any) {
    try {
      const trainingData = await this.databaseService.getTrainingData(query);
      return trainingData || [];
    } catch (error) {
      this.logger.error('Error fetching training data:', error);
      return [];
    }
  }

  async getTrainingJobs() {
    try {
      // Return all training jobs, sorted by most recent first
      return this.trainingJobs.sort((a, b) => 
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
    } catch (error) {
      this.logger.error('Error fetching training jobs:', error);
      return [];
    }
  }

  async getQAData(query?: any) {
    try {
      const qaData = await this.databaseService.getQAData(query);
      return qaData || [];
    } catch (error) {
      this.logger.error('Error fetching Q&A data:', error);
      return [];
    }
  }

  async stopTraining(jobId: string) {
    try {
      const job = this.trainingJobs.find(j => j.id === jobId);
      if (job) {
        job.status = 'stopped';
        job.stoppedAt = new Date().toISOString();
        return {
          jobId,
          status: 'stopped',
          message: 'Training job has been stopped',
        };
      } else {
        return {
          jobId,
          status: 'not_found',
          message: 'Training job not found',
        };
      }
    } catch (error) {
      this.logger.error('Error stopping training job:', error);
      throw error;
    }
  }

  async deleteTrainingData(id: string) {
    try {
      await this.databaseService.deleteTrainingData(id);
      return {
        success: true,
        message: 'Training data deleted successfully',
      };
    } catch (error) {
      this.logger.error('Error deleting training data:', error);
      throw error;
    }
  }
}