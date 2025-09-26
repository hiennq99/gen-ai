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
import { SpiritualGuidanceAdminService } from './spiritual-guidance-admin.service';
import { CitationService } from '../citation.service';
import { QualityControlService } from '../quality-control.service';
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
}