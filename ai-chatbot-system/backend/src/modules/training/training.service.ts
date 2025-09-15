import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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
    private readonly _documentsService: DocumentsService,
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
      // Format the answers in existing training data
      if (trainingData && Array.isArray(trainingData)) {
        return trainingData.map(item => ({
          ...item,
          answer: item.answer ? this.formatAnswerText(item.answer) : item.answer
        }));
      }
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
      // Format the answers in existing data
      if (qaData && Array.isArray(qaData)) {
        return qaData.map(item => ({
          ...item,
          answer: this.formatAnswerText(item.answer || '')
        }));
      }
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

  async uploadCSV(file: Express.Multer.File, options: any) {
    try {
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }

      if (!file.originalname.toLowerCase().endsWith('.csv')) {
        throw new BadRequestException('File must be a CSV file');
      }

      const {
        name = 'CSV Training Job',
        description = '',
        questionColumn = 'question',
        answerColumn = 'answer',
      } = options;

      const jobId = `csv-${uuidv4().substring(0, 8)}`;
      this.logger.log(`Processing CSV upload for job ${jobId}`);

      // Parse CSV file
      const csvData = await this.parseCSV(file.buffer, questionColumn, answerColumn);

      if (csvData.length === 0) {
        throw new BadRequestException('CSV file contains no valid question/answer pairs');
      }

      // Save Q&A data to database
      const qaResults = [];
      for (const row of csvData) {
        const qaId = uuidv4();

        // Format answer text first, then enhance with dummy media data
        const formattedAnswer = this.formatAnswerText(row.answer);
        const enhancedAnswer = this.addDummyMediaData(formattedAnswer);

        const qaData = {
          id: qaId,
          question: row.question,
          answer: enhancedAnswer,
          metadata: {
            source: 'csv_upload',
            jobId,
            uploadedAt: new Date().toISOString(),
            ...row.metadata,
          },
          createdAt: new Date().toISOString(),
        };

        // Save to database (assuming there's a Q&A table)
        try {
          await this.databaseService.saveQAData(qaData);
          qaResults.push(qaData);
        } catch (error) {
          this.logger.warn(`Failed to save Q&A pair ${qaId}:`, error);
        }
      }

      // Create training job
      const newJob = {
        id: jobId,
        type: 'CSV Q&A Training',
        name,
        description,
        documents: [], // No documents for CSV training
        status: 'completed', // CSV processing completes immediately
        progress: 100,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        recordsProcessed: qaResults.length,
        parameters: {
          questionColumn,
          answerColumn,
          totalRows: csvData.length,
          successfulRows: qaResults.length,
        },
        csvData: qaResults,
      };

      this.trainingJobs.push(newJob);

      // Queue training job for processing (if needed)
      await this.queueService.sendMessage('training', {
        type: 'csv-training-job',
        jobId,
        data: {
          ...newJob,
          qaData: qaResults,
        },
        timestamp: new Date().toISOString(),
      }).catch(error => {
        this.logger.warn('Queue service not available, continuing without queue:', error.message);
      });

      return {
        jobId,
        status: 'completed',
        message: `Successfully processed ${qaResults.length} Q&A pairs from CSV`,
        recordsProcessed: qaResults.length,
        totalRows: csvData.length,
      };

    } catch (error) {
      this.logger.error('Error processing CSV upload:', error);
      throw error;
    }
  }

  private async parseCSV(buffer: Buffer, questionColumn: string, answerColumn: string): Promise<any[]> {
    try {
      const csvText = buffer.toString('utf-8');

      if (!csvText.trim()) {
        throw new BadRequestException('CSV file is empty');
      }

      // Parse CSV properly handling multi-line quoted fields
      const rows = this.parseCSVText(csvText);

      if (rows.length === 0) {
        throw new BadRequestException('CSV file contains no data');
      }

      // Parse header row
      const headers = rows[0];
      const questionIndex = headers.indexOf(questionColumn);
      const answerIndex = headers.indexOf(answerColumn);

      if (questionIndex === -1) {
        throw new BadRequestException(`Question column "${questionColumn}" not found in CSV`);
      }
      if (answerIndex === -1) {
        throw new BadRequestException(`Answer column "${answerColumn}" not found in CSV`);
      }

      const results: any[] = [];

      // Parse data rows
      for (let i = 1; i < rows.length; i++) {
        try {
          const values = rows[i];

          if (values.length !== headers.length) {
            this.logger.warn(`Row ${i + 1} has ${values.length} columns, expected ${headers.length}. Skipping.`);
            continue;
          }

          const question = values[questionIndex]?.toString().trim();
          const answer = values[answerIndex]?.toString().trim();

          if (question && answer) {
            // Extract other columns as metadata
            const metadata: any = {};
            headers.forEach((header, index) => {
              if (index !== questionIndex && index !== answerIndex && values[index]) {
                metadata[header] = values[index];
              }
            });

            results.push({
              question,
              answer,
              metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            });
          } else {
            this.logger.warn(`Row ${i + 1}: Skipping row with missing question or answer:`, {
              question: question || 'missing',
              answer: answer || 'missing',
            });
          }
        } catch (error) {
          this.logger.warn(`Error processing CSV row ${i + 1}:`, error);
        }
      }

      this.logger.log(`CSV parsing completed. Processed ${results.length} valid rows.`);
      return results;
    } catch (error: any) {
      this.logger.error('CSV parsing error:', error);
      throw new BadRequestException(`CSV parsing failed: ${error.message}`);
    }
  }

  private parseCSVText(csvText: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    while (i < csvText.length) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote - add a single quote to the field
          currentField += '"';
          i += 2; // Skip both quotes
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator - only when not in quotes
        currentRow.push(currentField);
        currentField = '';
        i++;
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        // Row separator - only when not in quotes
        if (currentField || currentRow.length > 0) {
          currentRow.push(currentField);
          if (currentRow.some(field => field.trim())) {
            // Only add non-empty rows
            rows.push(currentRow);
          }
          currentRow = [];
          currentField = '';
        }

        // Skip \r\n combination
        if (char === '\r' && nextChar === '\n') {
          i += 2;
        } else {
          i++;
        }
      } else {
        // Regular character
        currentField += char;
        i++;
      }
    }

    // Add the last field and row
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField);
      if (currentRow.some(field => field.trim())) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  async clearAllQAData() {
    try {
      // Clear Q&A data via database service
      await this.databaseService.clearQAData();

      return {
        success: true,
        message: 'All Q&A training data has been cleared',
      };
    } catch (error) {
      this.logger.error('Error clearing Q&A data:', error);
      throw error;
    }
  }

  private formatAnswerText(text: string): string {
    if (!text) return text;

    // Format bullet points - split on ▪️ and rejoin with proper spacing
    if (text.includes('▪️')) {
      const parts = text.split('▪️').filter(part => part.trim().length > 0);

      if (parts.length > 1) {
        let result = parts[0].trim();
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i].trim();
          const spacedPart = part.startsWith(' ') ? part : ' ' + part;
          result += '\n▪️' + spacedPart;
        }

        // Handle breathing patterns
        result = result
          .replace(/(\s+)(Inhale:)/g, '\n$2')
          .replace(/(\s+)(Exhale:)/g, '\n$2')
          .trim();

        return result;
      }
    }

    // Handle breathing patterns for non-bullet text
    return text
      .replace(/(\s+)(Inhale:)/g, '\n$2')
      .replace(/(\s+)(Exhale:)/g, '\n$2')
      .trim();
  }

  private addDummyMediaData(answer: string): string {
    // Don't add media if answer already contains media references
    if (answer.match(/\[?(Image|Video|Audio|Quran|Media):/i)) {
      return answer;
    }

    const mediaOptions = [
      {
        type: 'Image',
        content: 'Peaceful Islamic calligraphy showing "La ilaha illa Allah" (There is no god but Allah)',
        probability: 0.3
      },
      {
        type: 'Video',
        content: 'Short meditation video with nature sounds and Quranic recitation (3 minutes)',
        probability: 0.25
      },
      {
        type: 'Audio',
        content: 'Soothing recitation of Surah Al-Fatiha by Sheikh Mishary Rashid Alafasy',
        probability: 0.2
      },
      {
        type: 'Quran',
        content: 'Related verses: Surah Al-Baqarah 2:286 - "Allah does not burden a soul beyond that it can bear"',
        probability: 0.3
      },
      {
        type: 'Image',
        content: 'Inspirational Islamic quote image with beautiful Arabic calligraphy',
        probability: 0.25
      },
      {
        type: 'Video',
        content: 'Guided Islamic breathing exercise with dhikr (remembrance of Allah)',
        probability: 0.2
      }
    ];

    // Randomly decide if we should add media (60% chance)
    if (Math.random() > 0.6) {
      return answer;
    }

    // Select a random media item
    const randomMedia = mediaOptions[Math.floor(Math.random() * mediaOptions.length)];

    // Add the media reference at the end of the answer
    return `${answer}\n\n${randomMedia.type}: ${randomMedia.content}`;
  }
}