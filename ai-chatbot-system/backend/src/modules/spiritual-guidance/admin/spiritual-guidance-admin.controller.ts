import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { promises as fs } from 'fs';
import { SpiritualGuidanceAdminService } from './spiritual-guidance-admin.service';
import { CitationService } from '../citation.service';
import { QualityControlService } from '../quality-control.service';
import { TrainingDataService } from '../training-data.service';
import { QATrainingService } from '../qa-training.service';
import { FineTunedGuidanceService } from '../fine-tuned-guidance.service';
import { SearchService } from '../../search/search.service';
import { DatabaseService } from '../../database/database.service';
import {
  HandbookContent,
  TrainingData,
  CitationAnalytics,
} from './interfaces/admin.interface';

@ApiTags('spiritual-guidance-admin')
@Controller('admin/spiritual-guidance')
@ApiBearerAuth()
export class SpiritualGuidanceAdminController {
  private readonly logger = new Logger(SpiritualGuidanceAdminController.name);

  constructor(
    private readonly adminService: SpiritualGuidanceAdminService,
    private readonly citationService: CitationService,
    private readonly qualityControlService: QualityControlService,
    private readonly trainingDataService: TrainingDataService,
    private readonly qaTrainingService: QATrainingService,
    private readonly fineTunedGuidanceService: FineTunedGuidanceService,
    private readonly searchService: SearchService,
    private readonly databaseService: DatabaseService,
  ) {}

  // Spiritual Diseases Management
  @Post('diseases')
  @ApiOperation({ summary: 'Create a new spiritual disease' })
  async createSpiritualDisease(@Body() diseaseData: any) {
    try {
      const disease = await this.adminService.createSpiritualDisease(diseaseData);
      return {
        success: true,
        data: disease,
      };
    } catch (error) {
      this.logger.error('Failed to create spiritual disease', error);
      throw error;
    }
  }

  @Put('diseases/:name')
  @ApiOperation({ summary: 'Update a spiritual disease' })
  async updateSpiritualDisease(
    @Param('name') name: string,
    @Body() updates: any
  ) {
    try {
      const disease = await this.adminService.updateSpiritualDisease(name, updates);
      return {
        success: true,
        data: disease,
      };
    } catch (error) {
      this.logger.error('Failed to update spiritual disease', error);
      throw error;
    }
  }

  @Delete('diseases/:name')
  @ApiOperation({ summary: 'Delete a spiritual disease' })
  async deleteSpiritualDisease(@Param('name') name: string) {
    try {
      await this.adminService.deleteSpiritualDisease(name);
      return {
        success: true,
        message: 'Spiritual disease deleted successfully',
      };
    } catch (error) {
      this.logger.error('Failed to delete spiritual disease', error);
      throw error;
    }
  }

  // Handbook Content Management
  @Get('handbook')
  @ApiOperation({ summary: 'Get handbook content with filters' })
  async getHandbookContent(@Query() filters: any) {
    try {
      const content = await this.adminService.getHandbookContent(filters);
      return {
        success: true,
        data: content,
        total: content.length,
      };
    } catch (error) {
      this.logger.error('Failed to get handbook content', error);
      throw error;
    }
  }

  @Post('handbook')
  @ApiOperation({ summary: 'Create new handbook content' })
  async createHandbookContent(@Body() contentData: Partial<HandbookContent>) {
    try {
      const content = await this.adminService.createHandbookContent(contentData);
      return {
        success: true,
        data: content,
      };
    } catch (error) {
      this.logger.error('Failed to create handbook content', error);
      throw error;
    }
  }

  @Put('handbook/:id')
  @ApiOperation({ summary: 'Update handbook content' })
  async updateHandbookContent(
    @Param('id') id: string,
    @Body() updates: Partial<HandbookContent>
  ) {
    try {
      const content = await this.adminService.updateHandbookContent(id, updates);
      return {
        success: true,
        data: content,
      };
    } catch (error) {
      this.logger.error('Failed to update handbook content', error);
      throw error;
    }
  }

  @Delete('handbook/:id')
  @ApiOperation({ summary: 'Delete handbook content' })
  async deleteHandbookContent(@Param('id') id: string) {
    try {
      await this.adminService.deleteHandbookContent(id);
      return {
        success: true,
        message: 'Handbook content deleted successfully',
      };
    } catch (error) {
      this.logger.error('Failed to delete handbook content', error);
      throw error;
    }
  }

  // Training Data Management
  @Get('training')
  @ApiOperation({ summary: 'Get training data' })
  async getTrainingData(@Query('type') type?: string) {
    try {
      const data = await this.adminService.getTrainingData(type);
      return {
        success: true,
        data,
        total: data.length,
      };
    } catch (error) {
      this.logger.error('Failed to get training data', error);
      throw error;
    }
  }

  @Post('training')
  @ApiOperation({ summary: 'Create training data' })
  async createTrainingData(@Body() trainingData: Partial<TrainingData>) {
    try {
      const data = await this.adminService.createTrainingData(trainingData);
      return {
        success: true,
        data,
      };
    } catch (error) {
      this.logger.error('Failed to create training data', error);
      throw error;
    }
  }

  @Put('training/:id')
  @ApiOperation({ summary: 'Update training data' })
  async updateTrainingData(
    @Param('id') id: string,
    @Body() updates: Partial<TrainingData>
  ) {
    try {
      const data = await this.adminService.updateTrainingData(id, updates);
      return {
        success: true,
        data,
      };
    } catch (error) {
      this.logger.error('Failed to update training data', error);
      throw error;
    }
  }

  @Delete('training/:id')
  @ApiOperation({ summary: 'Delete training data' })
  async deleteTrainingData(@Param('id') id: string) {
    try {
      await this.adminService.deleteTrainingData(id);
      return {
        success: true,
        message: 'Training data deleted successfully',
      };
    } catch (error) {
      this.logger.error('Failed to delete training data', error);
      throw error;
    }
  }

  // Import & Export
  @Post('import/handbook')
  @ApiOperation({ summary: 'Import handbook content from file' })
  @UseInterceptors(FileInterceptor('file'))
  async importHandbookContent(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    try {
      const result = await this.adminService.importHandbookContent(file);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error('Failed to import handbook content', error);
      throw error;
    }
  }

  @Get('export/training')
  @ApiOperation({ summary: 'Export training data' })
  async exportTrainingData(@Query('format') format: 'json' | 'csv' | 'xlsx' = 'json') {
    try {
      const data = await this.adminService.exportTrainingData(format);
      return data; // Return the blob/buffer directly
    } catch (error) {
      this.logger.error('Failed to export training data', error);
      throw error;
    }
  }

  // Validation & Analytics
  @Post('validate')
  @ApiOperation({ summary: 'Validate training data' })
  async validateTrainingData() {
    try {
      const result = await this.adminService.validateTrainingData();
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error('Failed to validate training data', error);
      throw error;
    }
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get spiritual guidance analytics' })
  async getAnalytics(): Promise<{ success: boolean; data: CitationAnalytics }> {
    try {
      const analytics = await this.adminService.getAnalytics();
      return {
        success: true,
        data: analytics,
      };
    } catch (error) {
      this.logger.error('Failed to get analytics', error);
      throw error;
    }
  }

  // Testing Tools
  @Post('test/guidance')
  @ApiOperation({ summary: 'Test spiritual guidance response' })
  async testGuidanceResponse(@Body() body: {
    message: string;
    emotionalState?: any;
    conversationHistory?: string[];
  }) {
    try {
      const result = await this.adminService.testGuidanceResponse(body);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error('Failed to test guidance response', error);
      throw error;
    }
  }

  @Post('test/citations')
  @ApiOperation({ summary: 'Test citation matching system' })
  async testCitationMatching(@Body() body: {
    message: string;
    emotion?: string;
  }) {
    try {
      // Use existing citation service test
      const result = await this.citationService.findCitationMatch(
        { primaryEmotion: body.emotion || 'neutral', intensity: 0.5, triggers: [], context: 'test' },
        body.message
      );

      return {
        success: true,
        data: {
          message: body.message,
          emotion: body.emotion,
          citationMatch: result,
        },
      };
    } catch (error) {
      this.logger.error('Failed to test citation matching', error);
      throw error;
    }
  }

  // Quality Control
  @Post('quality/audit')
  @ApiOperation({ summary: 'Audit response quality' })
  async auditResponseQuality(@Body() body: {
    response: any;
    originalMessage: string;
    emotionalState?: any;
  }) {
    try {
      const result = await this.qualityControlService.auditResponse(
        body.response,
        body.originalMessage
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error('Failed to audit response quality', error);
      throw error;
    }
  }

  // Bulk Operations
  @Post('bulk/update-diseases')
  @ApiOperation({ summary: 'Bulk update spiritual diseases' })
  async bulkUpdateDiseases(@Body() body: {
    updates: Array<{ name: string; data: any }>;
  }) {
    try {
      const results = await this.adminService.bulkUpdateDiseases(body.updates);
      return {
        success: true,
        data: results,
      };
    } catch (error) {
      this.logger.error('Failed to bulk update diseases', error);
      throw error;
    }
  }

  @Post('bulk/sync')
  @ApiOperation({ summary: 'Sync training data with citation service' })
  async syncTrainingData() {
    try {
      await this.adminService.syncTrainingData();
      return {
        success: true,
        message: 'Training data synced successfully',
      };
    } catch (error) {
      this.logger.error('Failed to sync training data', error);
      throw error;
    }
  }

  // New endpoints for hybrid approach

  @Post('training/upload')
  @ApiOperation({ summary: 'Upload training documents (PDF, DOCX, TXT)' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadTrainingDocument(
    @UploadedFile() file: Express.Multer.File,
    @Query('category') category: 'handbook' | 'qa' | 'general' = 'general'
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    try {
      const result = await this.adminService.processTrainingFile(file, category);
      return result;
    } catch (error) {
      this.logger.error('Failed to upload training document', error);
      throw error;
    }
  }

  @Post('training/upload-multiple')
  @ApiOperation({ summary: 'Upload multiple training documents' })
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMultipleTrainingDocuments(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('category') category: 'handbook' | 'qa' | 'general' = 'general'
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    try {
      const result = await this.adminService.processMultipleTrainingFiles(files, category);
      return result;
    } catch (error) {
      this.logger.error('Failed to upload multiple training documents', error);
      throw error;
    }
  }

  @Get('training/search')
  @ApiOperation({ summary: 'Search processed training documents' })
  async searchTrainingDocuments(
    @Query('query') query: string,
    @Query('limit') limit?: number,
    @Query('categories') categories?: string,
    @Query('minSimilarity') minSimilarity?: number
  ) {
    if (!query) {
      throw new BadRequestException('Search query is required');
    }

    try {
      const options: any = {};
      if (limit) options.limit = parseInt(limit.toString());
      if (categories) options.categories = categories.split(',');
      if (minSimilarity) options.minSimilarity = parseFloat(minSimilarity.toString());

      const result = await this.adminService.searchProcessedDocuments(query, options);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error('Failed to search training documents', error);
      throw error;
    }
  }

  @Get('training/stats')
  @ApiOperation({ summary: 'Get training document statistics' })
  async getTrainingStats() {
    try {
      const stats = await this.adminService.getTrainingDocumentStats();
      return {
        success: true,
        data: stats
      };
    } catch (error) {
      this.logger.error('Failed to get training stats', error);
      throw error;
    }
  }

  // NEW FINE-TUNED MODEL ENDPOINTS

  @Post('fine-tuned/prepare-training-data')
  @ApiOperation({ summary: 'Prepare training data for fine-tuning' })
  async prepareTrainingData() {
    try {
      const result = await this.trainingDataService.prepareQATrainingData();
      return {
        success: true,
        data: result,
        message: `Prepared ${result.examples.length} training examples`
      };
    } catch (error) {
      this.logger.error('Failed to prepare training data', error);
      throw error;
    }
  }

  @Post('fine-tuned/save-training-data')
  @ApiOperation({ summary: 'Save training data to file for fine-tuning' })
  async saveTrainingDataToFile(@Body() body: {
    filename?: string;
    includeValidation?: boolean;
  }) {
    try {
      // Prepare data first
      const trainingData = await this.trainingDataService.prepareQATrainingData();

      // Validate if requested
      let validation = null;
      if (body.includeValidation) {
        validation = await this.trainingDataService.validateTrainingData(trainingData.examples);
      }

      // Save to file
      const filePath = await this.trainingDataService.saveTrainingDataToFile(
        trainingData.examples,
        body.filename
      );

      return {
        success: true,
        data: {
          filePath,
          stats: trainingData.stats,
          validation: validation
        },
        message: `Training data saved to ${filePath}`
      };
    } catch (error) {
      this.logger.error('Failed to save training data', error);
      throw error;
    }
  }

  @Post('fine-tuned/validate-training-data')
  @ApiOperation({ summary: 'Validate training data quality' })
  async validateFineTunedTrainingData() {
    try {
      const trainingData = await this.trainingDataService.prepareQATrainingData();
      const validation = await this.trainingDataService.validateTrainingData(trainingData.examples);

      return {
        success: true,
        data: validation,
        message: validation.valid ? 'Training data is valid' : `Found ${validation.issues.length} issues`
      };
    } catch (error) {
      this.logger.error('Failed to validate training data', error);
      throw error;
    }
  }

  @Post('fine-tuned/train-model')
  @ApiOperation({ summary: 'Start fine-tuning the spiritual guidance model' })
  async trainFineTunedModel() {
    try {
      const result = await this.fineTunedGuidanceService.trainModel();
      return result;
    } catch (error) {
      this.logger.error('Failed to start fine-tuning', error);
      throw error;
    }
  }

  @Get('fine-tuned/model-status')
  @ApiOperation({ summary: 'Get fine-tuned model status and statistics' })
  async getFineTunedModelStatus() {
    try {
      const status = await this.fineTunedGuidanceService.getModelStatus();
      return {
        success: true,
        data: status
      };
    } catch (error) {
      this.logger.error('Failed to get model status', error);
      throw error;
    }
  }

  @Post('fine-tuned/test-guidance')
  @ApiOperation({ summary: 'Test fine-tuned spiritual guidance' })
  async testFineTunedGuidance(@Body() body: {
    message: string;
    conversationHistory?: string[];
  }) {
    try {
      const result = await this.fineTunedGuidanceService.provideSpiritualGuidance({
        message: body.message,
        conversationHistory: body.conversationHistory
      });

      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error('Failed to test fine-tuned guidance', error);
      throw error;
    }
  }

  // NEW Q&A TRAINING ENDPOINTS

  @Post('qa/prepare-training-data')
  @ApiOperation({ summary: 'Prepare Q&A training data (pure question-answer pairs)' })
  async prepareQATrainingData() {
    try {
      const result = await this.qaTrainingService.prepareQATrainingData();
      return {
        success: true,
        data: result,
        message: `Prepared ${result.examples.length} Q&A training examples`
      };
    } catch (error) {
      this.logger.error('Failed to prepare Q&A training data', error);
      throw error;
    }
  }

  @Post('qa/validate-training-data')
  @ApiOperation({ summary: 'Validate Q&A training data quality' })
  async validateQATrainingData() {
    try {
      const trainingData = await this.qaTrainingService.prepareQATrainingData();
      const validation = await this.qaTrainingService.validateQATrainingData(trainingData.examples);

      return {
        success: true,
        data: validation,
        message: validation.valid ? 'Q&A training data is valid' : `Found ${validation.issues.length} issues`
      };
    } catch (error) {
      this.logger.error('Failed to validate Q&A training data', error);
      throw error;
    }
  }

  @Post('qa/save-training-data')
  @ApiOperation({ summary: 'Save Q&A training data to file' })
  async saveQATrainingData(@Body() body: {
    filename?: string;
  }) {
    try {
      const trainingData = await this.qaTrainingService.prepareQATrainingData();
      const filePath = await this.qaTrainingService.saveQATrainingData(
        trainingData.examples,
        body.filename
      );

      return {
        success: true,
        data: {
          filePath,
          stats: trainingData.stats
        },
        message: `Q&A training data saved to ${filePath}`
      };
    } catch (error) {
      this.logger.error('Failed to save Q&A training data', error);
      throw error;
    }
  }

  @Post('qa/add-custom-pairs')
  @ApiOperation({ summary: 'Add custom Q&A pairs to training data' })
  async addCustomQAPairs(@Body() body: {
    qaPairs: Array<{
      question: string;
      answer: string;
      category?: string;
      emotionalState?: string;
    }>;
  }) {
    try {
      // Add the required source field to each Q&A pair
      const qaPairsWithSource = body.qaPairs.map(qa => ({
        ...qa,
        source: {
          type: 'qa_training' as const,
          reference: 'Admin panel custom Q&A',
          originalQuestion: qa.question
        }
      }));
      const examples = await this.qaTrainingService.addCustomQAPairs(qaPairsWithSource);
      return {
        success: true,
        data: {
          addedExamples: examples.length,
          examples: examples
        },
        message: `Added ${examples.length} custom Q&A pairs`
      };
    } catch (error) {
      this.logger.error('Failed to add custom Q&A pairs', error);
      throw error;
    }
  }

  @Post('qa/import-from-file')
  @ApiOperation({ summary: 'Import Q&A pairs from uploaded file' })
  @UseInterceptors(FileInterceptor('file'))
  async importQAPairsFromFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    try {
      // Save file temporarily
      const tempPath = `/tmp/qa-import-${Date.now()}.txt`;
      await fs.writeFile(tempPath, file.buffer);

      const qaPairs = await this.qaTrainingService.importQAPairsFromFile(tempPath);

      // Clean up temp file
      await fs.unlink(tempPath);

      return {
        success: true,
        data: {
          importedPairs: qaPairs.length,
          pairs: qaPairs
        },
        message: `Imported ${qaPairs.length} Q&A pairs from file`
      };
    } catch (error) {
      this.logger.error('Failed to import Q&A pairs from file', error);
      throw error;
    }
  }

  @Post('qa/test-direct-response')
  @ApiOperation({ summary: 'Test direct Q&A response (no citations)' })
  async testDirectQAResponse(@Body() body: {
    message: string;
    conversationHistory?: string[];
  }) {
    try {
      const result = await this.fineTunedGuidanceService.provideSpiritualGuidance({
        message: body.message,
        conversationHistory: body.conversationHistory
      });

      return {
        success: true,
        data: result,
        note: 'This response is generated using pure Q&A training without citations'
      };
    } catch (error) {
      this.logger.error('Failed to test direct Q&A response', error);
      throw error;
    }
  }

  @Post('qa/test-csv-data')
  @ApiOperation({ summary: 'Test with CSV training data directly (bypass database)' })
  @UseInterceptors(FileInterceptor('file'))
  async testWithCSVData(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }

    try {
      // Save file temporarily
      const tempPath = `/tmp/csv-test-${Date.now()}.csv`;
      await fs.writeFile(tempPath, file.buffer);

      const result = await this.qaTrainingService.testWithCSVData(tempPath);

      // Clean up temp file
      await fs.unlink(tempPath);

      return {
        success: true,
        data: result,
        message: `Processed ${result.stats.totalExamples} Q&A examples from CSV`
      };
    } catch (error) {
      this.logger.error('Failed to test with CSV data', error);
      throw error;
    }
  }

  @Post('qa/test-ai-response-csv')
  @ApiOperation({ summary: 'Test AI response using CSV training data (no database)' })
  async testAIResponseWithCSV(@Body() body: {
    csvFilePath: string;
    testQuestion: string;
  }) {
    try {
      const result = await this.qaTrainingService.testAIWithCSVData(
        body.csvFilePath,
        body.testQuestion
      );

      return {
        success: true,
        data: result,
        message: 'AI response generated using CSV training data'
      };
    } catch (error) {
      this.logger.error('Failed to test AI response with CSV', error);
      throw error;
    }
  }

  @Post('qa/upload-csv')
  @ApiOperation({ summary: 'Upload CSV file, import Q&A data to database, and create vectors' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadCSVData(
    @UploadedFile() file: Express.Multer.File,
    @Query('createVectors') createVectors: boolean = true
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }

    try {
      // Save file temporarily
      const tempPath = `/tmp/csv-upload-${Date.now()}.csv`;
      await fs.writeFile(tempPath, file.buffer);

      // Parse CSV and import to database
      const result = await this.qaTrainingService.importCSVToDatabase(tempPath);

      let vectorsCreated = 0;

      // Create vectors for Q&A pairs if requested
      if (createVectors && result.importedPairs > 0) {
        try {
          this.logger.log('Creating vectors for CSV Q&A pairs...');

          // Load the imported Q&A data
          const qaData = await this.qaTrainingService.loadFromCSVFile(tempPath);

          for (const qa of qaData) {
            try {
              // Create combined text for vector search
              const combinedText = `Q: ${qa.question}\nA: ${qa.answer}`;

              // Generate embedding
              const embedding = await this.searchService.generateEmbedding(combinedText);

              // Store as vector document
              await this.databaseService.storeVectorDocument({
                id: `qa-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                text: combinedText,
                embedding,
                metadata: {
                  type: 'qa_pair',
                  sourceFile: file.originalname,
                  question: qa.question,
                  answer: qa.answer,
                  category: qa.category || 'general',
                  source: 'csv_upload',
                  createdAt: new Date().toISOString(),
                },
              });

              vectorsCreated++;
            } catch (vectorError) {
              this.logger.warn(`Failed to create vector for Q&A pair: ${qa.question}`, vectorError);
            }
          }

          this.logger.log(`Created ${vectorsCreated} vectors from CSV Q&A pairs`);
        } catch (vectorError) {
          this.logger.error('Failed to create vectors from CSV', vectorError);
        }
      }

      // Clean up temp file
      await fs.unlink(tempPath);

      return {
        success: true,
        data: {
          ...result,
          vectorsCreated,
        },
        message: `Successfully imported ${result.importedPairs} Q&A pairs from CSV${vectorsCreated > 0 ? ` and created ${vectorsCreated} vectors` : ''}`
      };
    } catch (error) {
      this.logger.error('Failed to upload CSV data', error);
      throw error;
    }
  }

  @Post('documents/upload-pdf')
  @ApiOperation({ summary: 'Upload PDF document and store as vectors for semantic search' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadPDFDocument(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('PDF file is required');
    }

    try {
      // Save file temporarily
      const tempPath = `/tmp/pdf-upload-${Date.now()}.pdf`;
      await fs.writeFile(tempPath, file.buffer);

      // Process PDF with vector storage
      const result = await this.qaTrainingService.processPDFWithVectors(tempPath);

      // Clean up temp file
      await fs.unlink(tempPath);

      return {
        success: true,
        data: result,
        message: `Successfully processed PDF: ${result.chunksCreated} chunks created, ${result.vectorsGenerated} vectors generated, ${result.indexedChunks} chunks indexed for semantic search`
      };
    } catch (error) {
      this.logger.error('Failed to upload PDF document', error);
      throw error;
    }
  }

  // Vector Database Management
  @Get('vectors/stats')
  @ApiOperation({ summary: 'Get vector database statistics' })
  async getVectorStats() {
    try {
      const stats = await this.databaseService.getVectorStats();
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error('Failed to get vector stats', error);
      throw error;
    }
  }

  @Get('vectors/search')
  @ApiOperation({ summary: 'Search vector database content' })
  async searchVectors(
    @Query('q') query: string,
    @Query('limit') limit: number = 10,
    @Query('threshold') threshold: number = 0.3,
    @Query('sourceFile') sourceFile?: string,
    @Query('documentId') documentId?: string,
  ) {
    if (!query) {
      throw new BadRequestException('Query parameter is required');
    }

    try {
      const results = await this.searchService.searchPDFContent(query, {
        limit: Math.min(limit, 50), // Cap at 50 results
        threshold: Math.max(threshold, 0.1), // Minimum threshold of 0.1
        sourceFile,
        documentId,
      });

      return {
        success: true,
        query,
        results: results.map(result => ({
          id: result.id,
          text: result.text.substring(0, 200) + (result.text.length > 200 ? '...' : ''),
          similarity: result.similarity,
          metadata: result.metadata,
          highlight: result.highlight,
        })),
        total: results.length,
      };
    } catch (error) {
      this.logger.error('Failed to search vectors', error);
      throw error;
    }
  }

  @Get('vectors/documents')
  @ApiOperation({ summary: 'List all vector documents with metadata' })
  async listVectorDocuments(
    @Query('sourceFile') sourceFile?: string,
    @Query('type') type?: string,
    @Query('limit') limit: number = 20,
  ) {
    try {
      const filters: any = {};
      if (sourceFile) filters.sourceFile = sourceFile;
      if (type) filters.type = type;

      const results = await this.databaseService.searchVectorsByMetadata(filters, limit);

      return {
        success: true,
        documents: results.map(result => ({
          id: result.id,
          text: result.text.substring(0, 100) + (result.text.length > 100 ? '...' : ''),
          metadata: result.metadata,
        })),
        total: results.length,
        filters: { sourceFile, type },
      };
    } catch (error) {
      this.logger.error('Failed to list vector documents', error);
      throw error;
    }
  }

  @Get('vectors/document/:id')
  @ApiOperation({ summary: 'Get a specific vector document by ID' })
  async getVectorDocument(@Param('id') id: string) {
    try {
      const document = await this.databaseService.getVectorDocument(id);

      if (!document) {
        throw new BadRequestException(`Vector document ${id} not found`);
      }

      return {
        success: true,
        document: {
          id: document.id,
          text: document.text,
          metadata: document.metadata,
          embeddingLength: document.embedding?.length || 0,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get vector document ${id}`, error);
      throw error;
    }
  }

  @Delete('vectors/document/:id')
  @ApiOperation({ summary: 'Delete a specific vector document' })
  async deleteVectorDocument(@Param('id') id: string) {
    try {
      await this.databaseService.deleteVectorDocument(id);

      return {
        success: true,
        message: `Vector document ${id} deleted successfully`,
      };
    } catch (error) {
      this.logger.error(`Failed to delete vector document ${id}`, error);
      throw error;
    }
  }

  @Post('vectors/clear')
  @ApiOperation({ summary: 'Clear all vector documents (USE WITH CAUTION)' })
  async clearVectorDatabase() {
    try {
      await this.databaseService.clearVectorDatabase();

      return {
        success: true,
        message: 'Vector database cleared successfully',
      };
    } catch (error) {
      this.logger.error('Failed to clear vector database', error);
      throw error;
    }
  }

  @Get('vectors/similar/:id')
  @ApiOperation({ summary: 'Find documents similar to a specific document' })
  async findSimilarDocuments(
    @Param('id') id: string,
    @Query('limit') limit: number = 5,
    @Query('threshold') threshold: number = 0.7,
  ) {
    try {
      // Get the reference document
      const referenceDoc = await this.databaseService.getVectorDocument(id);

      if (!referenceDoc) {
        throw new BadRequestException(`Reference document ${id} not found`);
      }

      // Find similar documents
      const similarDocs = await this.searchService.searchSimilarContent(
        referenceDoc.text,
        {
          limit: Math.min(limit, 20),
          threshold: Math.max(threshold, 0.1),
          excludeId: id,
        }
      );

      return {
        success: true,
        referenceDocument: {
          id: referenceDoc.id,
          text: referenceDoc.text.substring(0, 100) + '...',
          metadata: referenceDoc.metadata,
        },
        similarDocuments: similarDocs.map(doc => ({
          id: doc.id,
          text: doc.text.substring(0, 100) + '...',
          similarity: doc.similarity,
          metadata: doc.metadata,
        })),
        total: similarDocs.length,
      };
    } catch (error) {
      this.logger.error(`Failed to find similar documents for ${id}`, error);
      throw error;
    }
  }
}