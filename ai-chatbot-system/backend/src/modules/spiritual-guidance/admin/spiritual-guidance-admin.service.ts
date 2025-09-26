import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CitationService } from '../citation.service';
import { SpiritualGuidanceService } from '../spiritual-guidance.service';
import { QualityControlService } from '../quality-control.service';
import { DocumentSearchService } from '../document-search.service';
import * as fs from 'fs';
import {
  SpiritualDisease,
  HandbookContent,
  TrainingData,
  CitationAnalytics,
} from './interfaces/admin.interface';
import * as XLSX from 'xlsx';

@Injectable()
export class SpiritualGuidanceAdminService {
  private readonly logger = new Logger(SpiritualGuidanceAdminService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly citationService: CitationService,
    private readonly spiritualGuidanceService: SpiritualGuidanceService,
    private readonly qualityControlService: QualityControlService,
    private readonly documentSearchService: DocumentSearchService,
  ) {}

  // Spiritual Diseases Management
  async createSpiritualDisease(diseaseData: Partial<SpiritualDisease>): Promise<SpiritualDisease> {
    try {
      const disease: SpiritualDisease = {
        name: diseaseData.name!,
        arabicName: diseaseData.arabicName!,
        pageRange: diseaseData.pageRange!,
        emotionalTriggers: diseaseData.emotionalTriggers || [],
        directQuotes: diseaseData.directQuotes || [],
        quranicEvidence: diseaseData.quranicEvidence || [],
        hadithEvidence: diseaseData.hadithEvidence || [],
      };

      // Save to database
      await this.databaseService.createItem('spiritual_diseases', {
        id: disease.name.toLowerCase().replace(/\s+/g, '_'),
        ...disease,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.logger.log(`Created spiritual disease: ${disease.name}`);
      return disease;
    } catch (error) {
      this.logger.error('Failed to create spiritual disease', error);
      throw error;
    }
  }

  async updateSpiritualDisease(name: string, updates: Partial<SpiritualDisease>): Promise<SpiritualDisease> {
    try {
      const id = name.toLowerCase().replace(/\s+/g, '_');
      const existing = await this.databaseService.getItem('spiritual_diseases', id);

      if (!existing) {
        throw new NotFoundException(`Spiritual disease '${name}' not found`);
      }

      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      };

      await this.databaseService.updateItem('spiritual_diseases', id, updated);

      this.logger.log(`Updated spiritual disease: ${name}`);
      return updated;
    } catch (error) {
      this.logger.error('Failed to update spiritual disease', error);
      throw error;
    }
  }

  async deleteSpiritualDisease(name: string): Promise<void> {
    try {
      const id = name.toLowerCase().replace(/\s+/g, '_');
      await this.databaseService.deleteItem('spiritual_diseases', id);

      this.logger.log(`Deleted spiritual disease: ${name}`);
    } catch (error) {
      this.logger.error('Failed to delete spiritual disease', error);
      throw error;
    }
  }

  // Handbook Content Management
  async getHandbookContent(filters?: any): Promise<HandbookContent[]> {
    try {
      const items = await this.databaseService.queryItems('handbook_content', filters);
      return items.map(item => ({
        id: item.id,
        title: item.title,
        arabicTitle: item.arabicTitle,
        chapter: item.chapter,
        pageStart: item.pageStart,
        pageEnd: item.pageEnd,
        content: item.content,
        spiritualDiseases: item.spiritualDiseases || [],
        quotes: item.quotes || [],
        quranicVerses: item.quranicVerses || [],
        hadithReferences: item.hadithReferences || [],
        keywords: item.keywords || [],
        emotionalTriggers: item.emotionalTriggers || [],
      }));
    } catch (error) {
      this.logger.error('Failed to get handbook content', error);
      throw error;
    }
  }

  async createHandbookContent(contentData: Partial<HandbookContent>): Promise<HandbookContent> {
    try {
      const id = `handbook_${Date.now()}`;
      const content: HandbookContent = {
        id,
        title: contentData.title!,
        arabicTitle: contentData.arabicTitle,
        chapter: contentData.chapter!,
        pageStart: contentData.pageStart!,
        pageEnd: contentData.pageEnd!,
        content: contentData.content!,
        spiritualDiseases: contentData.spiritualDiseases || [],
        quotes: contentData.quotes || [],
        quranicVerses: contentData.quranicVerses || [],
        hadithReferences: contentData.hadithReferences || [],
        keywords: contentData.keywords || [],
        emotionalTriggers: contentData.emotionalTriggers || [],
      };

      await this.databaseService.createItem('handbook_content', {
        ...content,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.logger.log(`Created handbook content: ${content.title}`);
      return content;
    } catch (error) {
      this.logger.error('Failed to create handbook content', error);
      throw error;
    }
  }

  async updateHandbookContent(id: string, updates: Partial<HandbookContent>): Promise<HandbookContent> {
    try {
      const existing = await this.databaseService.getItem('handbook_content', id);

      if (!existing) {
        throw new NotFoundException(`Handbook content with id '${id}' not found`);
      }

      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      };

      await this.databaseService.updateItem('handbook_content', id, updated);

      this.logger.log(`Updated handbook content: ${id}`);
      return updated;
    } catch (error) {
      this.logger.error('Failed to update handbook content', error);
      throw error;
    }
  }

  async deleteHandbookContent(id: string): Promise<void> {
    try {
      await this.databaseService.deleteItem('handbook_content', id);
      this.logger.log(`Deleted handbook content: ${id}`);
    } catch (error) {
      this.logger.error('Failed to delete handbook content', error);
      throw error;
    }
  }

  // Training Data Management
  async getTrainingData(type?: string): Promise<TrainingData[]> {
    try {
      const filters = type ? { type } : {};
      const items = await this.databaseService.queryItems('training_data', filters);

      return items.map(item => ({
        id: item.id,
        type: item.type,
        content: item.content,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        createdBy: item.createdBy,
      }));
    } catch (error) {
      this.logger.error('Failed to get training data', error);
      throw error;
    }
  }

  async createTrainingData(trainingData: Partial<TrainingData>): Promise<TrainingData> {
    try {
      const id = `training_${Date.now()}`;
      const data: TrainingData = {
        id,
        type: trainingData.type!,
        content: trainingData.content!,
        status: trainingData.status || 'pending_review',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: trainingData.createdBy || 'admin',
      };

      await this.databaseService.createItem('training_data', data);

      this.logger.log(`Created training data: ${id}`);
      return data;
    } catch (error) {
      this.logger.error('Failed to create training data', error);
      throw error;
    }
  }

  async updateTrainingData(id: string, updates: Partial<TrainingData>): Promise<TrainingData> {
    try {
      const existing = await this.databaseService.getItem('training_data', id);

      if (!existing) {
        throw new NotFoundException(`Training data with id '${id}' not found`);
      }

      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      };

      await this.databaseService.updateItem('training_data', id, updated);

      this.logger.log(`Updated training data: ${id}`);
      return updated;
    } catch (error) {
      this.logger.error('Failed to update training data', error);
      throw error;
    }
  }

  async deleteTrainingData(id: string): Promise<void> {
    try {
      await this.databaseService.deleteItem('training_data', id);
      this.logger.log(`Deleted training data: ${id}`);
    } catch (error) {
      this.logger.error('Failed to delete training data', error);
      throw error;
    }
  }

  // Import & Export
  async importHandbookContent(file: Express.Multer.File): Promise<{ success: number; errors: any[] }> {
    try {
      let data: any[];

      if (file.mimetype.includes('json')) {
        data = JSON.parse(file.buffer.toString());
      } else if (file.mimetype.includes('excel') || file.mimetype.includes('spreadsheet')) {
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      } else {
        throw new Error('Unsupported file format. Please use JSON or Excel.');
      }

      let successCount = 0;
      const errors: any[] = [];

      for (const item of data) {
        try {
          await this.createHandbookContent({
            title: item.title,
            arabicTitle: item.arabicTitle,
            chapter: item.chapter,
            pageStart: parseInt(item.pageStart),
            pageEnd: parseInt(item.pageEnd),
            content: item.content,
            spiritualDiseases: Array.isArray(item.spiritualDiseases)
              ? item.spiritualDiseases
              : (item.spiritualDiseases || '').split(',').map((s: string) => s.trim()),
            keywords: Array.isArray(item.keywords)
              ? item.keywords
              : (item.keywords || '').split(',').map((s: string) => s.trim()),
            emotionalTriggers: Array.isArray(item.emotionalTriggers)
              ? item.emotionalTriggers
              : (item.emotionalTriggers || '').split(',').map((s: string) => s.trim()),
          });
          successCount++;
        } catch (error) {
          errors.push({
            item,
            error: error.message,
          });
        }
      }

      this.logger.log(`Imported ${successCount} handbook items with ${errors.length} errors`);
      return { success: successCount, errors };
    } catch (error) {
      this.logger.error('Failed to import handbook content', error);
      throw error;
    }
  }

  async exportTrainingData(format: 'json' | 'csv' | 'xlsx' = 'json'): Promise<Buffer> {
    try {
      const data = await this.getTrainingData();

      if (format === 'json') {
        return Buffer.from(JSON.stringify(data, null, 2));
      }

      // Convert to worksheet format
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Training Data');

      if (format === 'csv') {
        return Buffer.from(XLSX.utils.sheet_to_csv(worksheet));
      }

      return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    } catch (error) {
      this.logger.error('Failed to export training data', error);
      throw error;
    }
  }

  // Validation & Analytics
  async validateTrainingData(): Promise<{
    valid: number;
    invalid: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    try {
      const data = await this.getTrainingData();
      let validCount = 0;
      const errors: Array<{ id: string; error: string }> = [];

      for (const item of data) {
        try {
          // Validate based on type
          switch (item.type) {
            case 'spiritual_disease':
              this.validateSpiritualDisease(item.content);
              break;
            case 'citation':
              this.validateCitation(item.content);
              break;
            case 'response_template':
              this.validateResponseTemplate(item.content);
              break;
            case 'handbook_content':
              this.validateHandbookContent(item.content);
              break;
            default:
              throw new Error(`Unknown training data type: ${item.type}`);
          }
          validCount++;
        } catch (error) {
          errors.push({
            id: item.id!,
            error: error.message,
          });
        }
      }

      return {
        valid: validCount,
        invalid: errors.length,
        errors,
      };
    } catch (error) {
      this.logger.error('Failed to validate training data', error);
      throw error;
    }
  }

  async getAnalytics(): Promise<CitationAnalytics> {
    try {
      // Get spiritual diseases for popular diseases calculation
      const diseases = this.citationService.getAllSpiritualDiseases();

      // Mock analytics data - in a real system, this would come from usage logs
      const analytics: CitationAnalytics = {
        totalCitations: diseases.reduce((acc, disease) => acc + disease.directQuotes.length, 0),
        citationsByLevel: {
          'perfect_match': 150,
          'related_theme': 80,
          'general_guidance': 45,
          'no_direct_match': 25,
        },
        popularDiseases: diseases.map(disease => ({
          name: disease.name,
          count: Math.floor(Math.random() * 100) + 10, // Mock usage count
        })).sort((a, b) => b.count - a.count).slice(0, 5),
        qualityScores: {
          average: 0.85,
          distribution: {
            '0.9-1.0': 45,
            '0.8-0.9': 35,
            '0.7-0.8': 15,
            '0.6-0.7': 4,
            '0.0-0.6': 1,
          },
        },
        responseTime: 2.3, // seconds
      };

      return analytics;
    } catch (error) {
      this.logger.error('Failed to get analytics', error);
      throw error;
    }
  }

  // Testing
  async testGuidanceResponse(request: {
    message: string;
    emotionalState?: any;
    conversationHistory?: string[];
  }): Promise<any> {
    try {
      return await this.spiritualGuidanceService.provideSpiritualGuidance(request);
    } catch (error) {
      this.logger.error('Failed to test guidance response', error);
      throw error;
    }
  }

  // Bulk Operations
  async bulkUpdateDiseases(updates: Array<{ name: string; data: any }>): Promise<any[]> {
    const results = [];

    for (const update of updates) {
      try {
        const result = await this.updateSpiritualDisease(update.name, update.data);
        results.push({ success: true, name: update.name, data: result });
      } catch (error) {
        results.push({ success: false, name: update.name, error: error.message });
      }
    }

    return results;
  }

  async syncTrainingData(): Promise<void> {
    try {
      // Sync training data with citation service
      // This would reload the spiritual diseases in the citation service
      // For now, we just log the sync
      this.logger.log('Training data sync initiated');

      // In a real implementation, you might:
      // 1. Reload spiritual diseases from database
      // 2. Update citation service cache
      // 3. Restart citation matching algorithms
      // 4. Validate all data consistency

      this.logger.log('Training data sync completed');
    } catch (error) {
      this.logger.error('Failed to sync training data', error);
      throw error;
    }
  }

  // Private validation methods
  private validateSpiritualDisease(disease: any): void {
    if (!disease.name || !disease.arabicName || !disease.pageRange) {
      throw new Error('Spiritual disease must have name, arabicName, and pageRange');
    }

    if (!Array.isArray(disease.emotionalTriggers)) {
      throw new Error('emotionalTriggers must be an array');
    }
  }

  private validateCitation(citation: any): void {
    if (!citation.page || !citation.quote || !citation.context) {
      throw new Error('Citation must have page, quote, and context');
    }

    if (!['symptoms', 'treatment', 'evidence', 'general'].includes(citation.context)) {
      throw new Error('Citation context must be symptoms, treatment, evidence, or general');
    }
  }

  private validateResponseTemplate(template: any): void {
    if (!template.name || !template.level || !template.template) {
      throw new Error('Response template must have name, level, and template');
    }
  }

  private validateHandbookContent(content: any): void {
    if (!content.title || !content.chapter || !content.pageStart || !content.content) {
      throw new Error('Handbook content must have title, chapter, pageStart, and content');
    }
  }

  /**
   * Process uploaded PDF/DOCX files for training
   */
  async processTrainingFile(
    file: Express.Multer.File,
    category: 'handbook' | 'qa' | 'general'
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      this.logger.log(`Processing training file: ${file.originalname}, category: ${category}`);

      // Save file temporarily
      const tempFilePath = `/tmp/${Date.now()}-${file.originalname}`;
      fs.writeFileSync(tempFilePath, file.buffer);

      // Process file with document search service
      const chunks = await this.documentSearchService.processUploadedFile(tempFilePath, {
        originalName: file.originalname,
        category,
        fileType: this.getFileType(file.mimetype)
      });

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      this.logger.log(`Successfully processed ${file.originalname}: ${chunks.length} chunks created`);

      return {
        success: true,
        message: `Successfully processed file: ${chunks.length} text chunks extracted and indexed`,
        data: {
          filename: file.originalname,
          category,
          chunksCreated: chunks.length,
          totalSize: file.size
        }
      };

    } catch (error) {
      this.logger.error(`Failed to process training file: ${file.originalname}`, error);
      return {
        success: false,
        message: `Failed to process file: ${error.message}`
      };
    }
  }

  /**
   * Process multiple training files
   */
  async processMultipleTrainingFiles(
    files: Express.Multer.File[],
    category: 'handbook' | 'qa' | 'general'
  ): Promise<{
    results: Array<{ file: string; success: boolean; message: string; data?: any }>
  }> {
    const results = [];

    for (const file of files) {
      const result = await this.processTrainingFile(file, category);
      results.push({ file: file.originalname, ...result });
    }

    return { results };
  }

  /**
   * Get file type from mimetype
   */
  private getFileType(mimetype: string): string {
    if (mimetype.includes('pdf')) return 'pdf';
    if (mimetype.includes('word') || mimetype.includes('docx')) return 'docx';
    if (mimetype.includes('text')) return 'txt';
    if (mimetype.includes('csv')) return 'csv';
    if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return 'xlsx';
    return 'unknown';
  }

  /**
   * Search processed documents
   */
  async searchProcessedDocuments(
    query: string,
    options?: {
      limit?: number;
      categories?: ('handbook' | 'qa' | 'general')[];
      minSimilarity?: number;
    }
  ) {
    try {
      return await this.documentSearchService.searchDocuments(query, options);
    } catch (error) {
      this.logger.error('Document search failed', error);
      throw error;
    }
  }

  /**
   * Get training document statistics
   */
  async getTrainingDocumentStats() {
    try {
      // Get document counts by category
      const handbookSearch = await this.documentSearchService.searchDocuments('*', {
        limit: 0,
        categories: ['handbook']
      });

      const qaSearch = await this.documentSearchService.searchDocuments('*', {
        limit: 0,
        categories: ['qa']
      });

      const generalSearch = await this.documentSearchService.searchDocuments('*', {
        limit: 0,
        categories: ['general']
      });

      return {
        totalDocuments: handbookSearch.totalMatches + qaSearch.totalMatches + generalSearch.totalMatches,
        handbookDocuments: handbookSearch.totalMatches,
        qaDocuments: qaSearch.totalMatches,
        generalDocuments: generalSearch.totalMatches,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to get document stats', error);
      return {
        totalDocuments: 0,
        handbookDocuments: 0,
        qaDocuments: 0,
        generalDocuments: 0,
        lastUpdated: new Date().toISOString()
      };
    }
  }
}