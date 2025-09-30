import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { BedrockService } from '../bedrock/bedrock.service';
import { SearchService } from '../search/search.service';
import { EvidenceParserService } from './evidence-parser.service';
import { EvidenceChunkService } from './evidence-chunk.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import pdfParse from 'pdf-parse';

export interface QATrainingExample {
  question: string;
  answer: string;
  category?: string;
  emotionalState?: string;
  keywords?: string[];
  difficulty?: 'basic' | 'intermediate' | 'advanced';
  source: QASource;
}

export interface QASource {
  type: 'qa_training' | 'document' | 'handbook' | 'ai_knowledge';
  reference?: string; // For Q&A: original question, For documents: file path/page, For AI: 'Generated'
  location?: string; // Page number, section, etc.
  originalQuestion?: string; // For Q&A training - the question this answer came from
  documentPath?: string; // For document sources
  pageNumber?: number; // For handbook/document sources
}

export interface FineTuneFormat {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}

@Injectable()
export class QATrainingService {
  private readonly logger = new Logger(QATrainingService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly bedrockService: BedrockService,
    private readonly searchService: SearchService,
    private readonly evidenceParser: EvidenceParserService,
    private readonly evidenceChunkService: EvidenceChunkService,
  ) {}

  /**
   * Main method: Prepare Q&A training data from database sources only
   */
  async prepareQATrainingData(): Promise<{
    examples: FineTuneFormat[];
    stats: {
      totalExamples: number;
      byCategory: Record<string, number>;
      byEmotionalState: Record<string, number>;
      byDifficulty: Record<string, number>;
    };
  }> {
    this.logger.log('Starting Q&A training data preparation from database');

    const examples: FineTuneFormat[] = [];
    const stats = {
      totalExamples: 0,
      byCategory: {} as Record<string, number>,
      byEmotionalState: {} as Record<string, number>,
      byDifficulty: {} as Record<string, number>
    };

    // Get Q&A data from database (uploaded via CSV or admin interface)
    const existingQA = await this.loadExistingQAData();
    const existingExamples = this.convertToTrainingFormat(existingQA);
    examples.push(...existingExamples);
    stats.byCategory['database_qa'] = existingExamples.length;

    stats.totalExamples = examples.length;

    // Count by categories
    examples.forEach(example => {
      const userMessage = example.messages.find(m => m.role === 'user')?.content || '';
      const qaExample = this.extractQAMetadata(userMessage, '');

      const emotionalState = qaExample.emotionalState || 'neutral';
      stats.byEmotionalState[emotionalState] = (stats.byEmotionalState[emotionalState] || 0) + 1;

      const difficulty = qaExample.difficulty || 'intermediate';
      stats.byDifficulty[difficulty] = (stats.byDifficulty[difficulty] || 0) + 1;
    });

    this.logger.log('Q&A training data preparation completed', stats);
    return { examples, stats };
  }

  /**
   * Load Q&A data from database (uploaded via CSV)
   */
  private async loadExistingQAData(): Promise<QATrainingExample[]> {
    try {
      const qaData = await this.databaseService.getQAData();
      const qaPairs: QATrainingExample[] = [];

      for (const item of qaData) {
        if (item.question && item.answer) {
          qaPairs.push({
            question: item.question,
            answer: item.answer,
            category: item.category || 'uploaded',
            emotionalState: item.emotionalState || 'neutral',
            source: {
              type: 'qa_training',
              reference: `Database Q&A #${item.id || 'unknown'}`,
              originalQuestion: item.question
            }
          });
        }
      }

      return qaPairs;
    } catch (error) {
      this.logger.warn('Failed to fetch Q&A data from database', error);
      return [];
    }
  }

  /**
   * Convert Q&A pairs to training format
   */
  private convertToTrainingFormat(qaPairs: QATrainingExample[]): FineTuneFormat[] {
    return qaPairs.map(qa => ({
      messages: [
        { role: 'user', content: qa.question },
        { role: 'assistant', content: qa.answer }
      ]
    }));
  }

  /**
   * Extract Q&A metadata for categorization
   */
  private extractQAMetadata(question: string, answer: string): QATrainingExample {
    const questionLower = question.toLowerCase();

    // Determine emotional state
    let emotionalState = 'neutral';
    if (questionLower.includes('angry') || questionLower.includes('mad') || questionLower.includes('furious')) {
      emotionalState = 'anger';
    } else if (questionLower.includes('sad') || questionLower.includes('depressed') || questionLower.includes('hopeless')) {
      emotionalState = 'sadness';
    } else if (questionLower.includes('anxious') || questionLower.includes('worried') || questionLower.includes('scared')) {
      emotionalState = 'anxiety';
    } else if (questionLower.includes('lonely') || questionLower.includes('alone') || questionLower.includes('isolated')) {
      emotionalState = 'loneliness';
    } else if (questionLower.includes('overwhelmed') || questionLower.includes('stress')) {
      emotionalState = 'overwhelmed';
    }

    // Determine difficulty
    let difficulty: 'basic' | 'intermediate' | 'advanced' = 'intermediate';
    if (questionLower.includes('how do i') || questionLower.includes('what should i')) {
      difficulty = 'basic';
    } else if (questionLower.includes('why') && questionLower.includes('complex')) {
      difficulty = 'advanced';
    }

    // Extract keywords
    const keywords = questionLower.split(' ').filter(word =>
      word.length > 3 && !['what', 'how', 'why', 'when', 'where', 'should', 'could', 'would', 'will'].includes(word)
    );

    return {
      question,
      answer,
      emotionalState,
      difficulty,
      keywords,
      source: {
        type: 'qa_training',
        reference: 'Generated Metadata',
        originalQuestion: question
      }
    };
  }

  /**
   * Add custom Q&A pairs to training data
   */
  async addCustomQAPairs(qaPairs: QATrainingExample[]): Promise<FineTuneFormat[]> {
    const examples: FineTuneFormat[] = [];

    for (const qa of qaPairs) {
      examples.push({
        messages: [
          { role: 'user', content: qa.question },
          { role: 'assistant', content: qa.answer }
        ]
      });
    }

    return examples;
  }

  /**
   * Test CSV training data directly without database - for testing purposes
   */
  async testWithCSVData(csvFilePath: string): Promise<{
    examples: FineTuneFormat[];
    stats: {
      totalExamples: number;
      byCategory: Record<string, number>;
      byEmotionalState: Record<string, number>;
      byDifficulty: Record<string, number>;
    };
  }> {
    this.logger.log('Testing with CSV data directly (bypassing database)');

    // Load Q&A pairs from CSV file
    const qaPairs = await this.loadFromCSVFile(csvFilePath);

    // Convert to training format
    const examples = this.convertToTrainingFormat(qaPairs);

    // Generate stats
    const stats = {
      totalExamples: examples.length,
      byCategory: {} as Record<string, number>,
      byEmotionalState: {} as Record<string, number>,
      byDifficulty: {} as Record<string, number>
    };

    // Count by categories
    qaPairs.forEach(qa => {
      const category = qa.category || 'unknown';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

      const emotionalState = qa.emotionalState || 'neutral';
      stats.byEmotionalState[emotionalState] = (stats.byEmotionalState[emotionalState] || 0) + 1;

      const difficulty = qa.difficulty || 'intermediate';
      stats.byDifficulty[difficulty] = (stats.byDifficulty[difficulty] || 0) + 1;
    });

    this.logger.log('CSV testing data prepared', stats);
    return { examples, stats };
  }

  /**
   * Load Q&A pairs from CSV file (automatically detects question and answer columns)
   */
  async loadFromCSVFile(csvFilePath: string): Promise<QATrainingExample[]> {
    const qaPairs: QATrainingExample[] = [];

    try {
      const fileContent = await fs.readFile(csvFilePath, 'utf-8');
      const lines = fileContent.split('\n').map(line => line.trim()).filter(line => line);

      if (lines.length === 0) {
        throw new Error('CSV file is empty');
      }

      // Parse header to find column indices
      const headerColumns = this.parseCSVLine(lines[0]);
      const columnMap = this.detectColumnMapping(headerColumns);

      // Check if we found question and answer columns
      if (columnMap.questionIndex === -1 || columnMap.answerIndex === -1) {
        // Fallback: assume first two columns are question and answer
        columnMap.questionIndex = 0;
        columnMap.answerIndex = 1;
        this.logger.warn('Could not detect question/answer columns, using columns 0 and 1');
      }

      // Skip header if detected, otherwise start from first line
      const dataLines = columnMap.hasHeader ? lines.slice(1) : lines;

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];

        // Skip empty lines
        if (!line) continue;

        // Parse CSV line (handle comma-separated values with potential quotes)
        const columns = this.parseCSVLine(line);

        if (columns.length > Math.max(columnMap.questionIndex, columnMap.answerIndex)) {
          const question = columns[columnMap.questionIndex]?.trim();
          const answer = columns[columnMap.answerIndex]?.trim();
          const category = columns[columnMap.categoryIndex]?.trim() || 'imported';
          const emotionalState = columns[columnMap.emotionalStateIndex]?.trim() || 'neutral';
          const difficulty = (columns[columnMap.difficultyIndex]?.trim() as 'basic' | 'intermediate' | 'advanced') || 'intermediate';

          if (question && answer) {
            qaPairs.push({
              question,
              answer,
              category,
              emotionalState,
              difficulty,
              source: {
                type: 'qa_training',
                reference: `CSV File: ${csvFilePath}`,
                originalQuestion: question
              }
            });
          }
        }
      }

      this.logger.log(`Loaded ${qaPairs.length} Q&A pairs from CSV file: ${csvFilePath}`, {
        questionColumn: columnMap.questionIndex,
        answerColumn: columnMap.answerIndex,
        detectedHeader: columnMap.hasHeader
      });
      return qaPairs;

    } catch (error) {
      this.logger.error('Failed to load Q&A pairs from CSV file', error);
      throw error;
    }
  }

  /**
   * Detect column mapping from CSV header
   */
  private detectColumnMapping(headerColumns: string[]): {
    questionIndex: number;
    answerIndex: number;
    categoryIndex: number;
    emotionalStateIndex: number;
    difficultyIndex: number;
    hasHeader: boolean;
  } {
    const normalizedHeaders = headerColumns.map(h => h.toLowerCase().trim());

    // Common variations for question column
    const questionVariations = ['question', 'q', 'query', 'prompt', 'input', 'user_question', 'user'];
    // Common variations for answer column
    const answerVariations = ['answer', 'a', 'response', 'reply', 'output', 'assistant_answer', 'assistant'];
    // Common variations for category
    const categoryVariations = ['category', 'cat', 'type', 'topic', 'subject'];
    // Common variations for emotional state
    const emotionalVariations = ['emotion', 'emotional_state', 'mood', 'feeling', 'sentiment'];
    // Common variations for difficulty
    const difficultyVariations = ['difficulty', 'level', 'complexity'];

    let questionIndex = -1;
    let answerIndex = -1;
    let categoryIndex = -1;
    let emotionalStateIndex = -1;
    let difficultyIndex = -1;

    // Find question column
    for (let i = 0; i < normalizedHeaders.length; i++) {
      const header = normalizedHeaders[i];
      if (questionVariations.some(variation => header.includes(variation))) {
        questionIndex = i;
        break;
      }
    }

    // Find answer column
    for (let i = 0; i < normalizedHeaders.length; i++) {
      const header = normalizedHeaders[i];
      if (answerVariations.some(variation => header.includes(variation))) {
        answerIndex = i;
        break;
      }
    }

    // Find optional columns
    for (let i = 0; i < normalizedHeaders.length; i++) {
      const header = normalizedHeaders[i];
      if (categoryVariations.some(variation => header.includes(variation))) {
        categoryIndex = i;
      } else if (emotionalVariations.some(variation => header.includes(variation))) {
        emotionalStateIndex = i;
      } else if (difficultyVariations.some(variation => header.includes(variation))) {
        difficultyIndex = i;
      }
    }

    // Determine if first row is likely a header
    const hasHeader = questionIndex !== -1 || answerIndex !== -1 ||
                     normalizedHeaders.some(h =>
                       questionVariations.concat(answerVariations).some(v => h.includes(v))
                     );

    return {
      questionIndex,
      answerIndex,
      categoryIndex,
      emotionalStateIndex,
      difficultyIndex,
      hasHeader
    };
  }

  /**
   * Parse a single CSV line handling quotes and commas
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result.map(col => col.replace(/^"|"$/g, '')); // Remove surrounding quotes
  }

  /**
   * Test AI response with specific Q&A training data (no database)
   */
  async testAIWithCSVData(csvFilePath: string, testQuestion: string): Promise<{
    question: string;
    aiResponse: string;
    matchedTrainingData?: QATrainingExample;
    confidence: number;
  }> {
    // Load training data from CSV
    const trainingData = await this.loadFromCSVFile(csvFilePath);

    // Find best matching Q&A in training data
    const bestMatch = this.findBestMatch(testQuestion, trainingData);

    // Simulate AI response (you can integrate with actual AI model here)
    const aiResponse = await this.generateAIResponse(testQuestion, trainingData);

    return {
      question: testQuestion,
      aiResponse,
      matchedTrainingData: bestMatch.qa,
      confidence: bestMatch.confidence
    };
  }

  /**
   * Find best matching Q&A from training data
   */
  private findBestMatch(question: string, trainingData: QATrainingExample[]): {
    qa: QATrainingExample | undefined;
    confidence: number;
  } {
    const questionLower = question.toLowerCase();
    let bestMatch: QATrainingExample | undefined;
    let bestScore = 0;

    for (const qa of trainingData) {
      const trainingQuestionLower = qa.question.toLowerCase();

      // Simple similarity scoring based on common words
      const questionWords = questionLower.split(' ').filter(word => word.length > 3);
      const trainingWords = trainingQuestionLower.split(' ').filter(word => word.length > 3);

      const commonWords = questionWords.filter(word => trainingWords.includes(word));
      const score = commonWords.length / Math.max(questionWords.length, trainingWords.length);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = qa;
      }
    }

    return {
      qa: bestMatch,
      confidence: bestScore
    };
  }

  /**
   * Generate AI response using training data context
   */
  private async generateAIResponse(question: string, trainingData: QATrainingExample[]): Promise<string> {
    // Find relevant training examples
    const relevantExamples = trainingData
      .map(qa => ({
        qa,
        relevance: this.calculateRelevance(question, qa.question)
      }))
      .filter(item => item.relevance > 0.1)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 3) // Top 3 most relevant
      .map(item => item.qa);

    // Build context from relevant examples
    const context = relevantExamples
      .map(qa => `Q: ${qa.question}\nA: ${qa.answer}`)
      .join('\n\n');

    // Create prompt for AI
    const prompt = `Based on these spiritual guidance examples:

${context}

Please provide spiritual guidance for this question: ${question}

Response:`;

    try {
      // You can integrate with your actual AI service here
      // For now, return a placeholder or use the best match
      const bestMatch = relevantExamples[0];
      if (bestMatch) {
        return bestMatch.answer;
      } else {
        return "I understand you're seeking spiritual guidance. While I don't have a specific answer for your question, I encourage you to reflect on your inner wisdom and seek support from trusted spiritual guides.";
      }
    } catch (error) {
      this.logger.error('Failed to generate AI response', error);
      throw error;
    }
  }

  /**
   * Calculate relevance between two questions
   */
  private calculateRelevance(question1: string, question2: string): number {
    const words1 = question1.toLowerCase().split(' ').filter(word => word.length > 3);
    const words2 = question2.toLowerCase().split(' ').filter(word => word.length > 3);

    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  /**
   * Import Q&A pairs from uploaded CSV file
   */
  async importQAPairsFromFile(filePath: string): Promise<QATrainingExample[]> {
    const qaPairs: QATrainingExample[] = [];

    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');

      // Try to parse as JSON first (for structured uploads)
      try {
        const jsonData = JSON.parse(fileContent);
        if (Array.isArray(jsonData)) {
          for (const item of jsonData) {
            if (item.question && item.answer) {
              qaPairs.push({
                question: item.question,
                answer: item.answer,
                category: item.category || 'imported',
                emotionalState: item.emotionalState || 'neutral',
                source: {
                  type: 'qa_training',
                  reference: 'Imported from File',
                  originalQuestion: item.question
                }
              });
            }
          }
        }
      } catch {
        // Try to parse as simple text format (question on one line, answer on next)
        const lines = fileContent.split('\n').map(line => line.trim()).filter(line => line);
        for (let i = 0; i < lines.length - 1; i += 2) {
          const question = lines[i];
          const answer = lines[i + 1];
          if (question && answer && question.endsWith('?')) {
            qaPairs.push({
              question,
              answer,
              category: 'imported',
              source: {
                type: 'qa_training',
                reference: 'Imported from File',
                originalQuestion: question
              }
            });
          }
        }
      }

      return qaPairs;
    } catch (error) {
      this.logger.error('Failed to import Q&A pairs from file', error);
      throw error;
    }
  }

  /**
   * Save Q&A training data to JSONL file
   */
  async saveQATrainingData(examples: FineTuneFormat[], filename?: string): Promise<string> {
    const outputPath = path.join(process.cwd(), 'training-data', filename || `qa-training-${Date.now()}.jsonl`);

    // Ensure directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Convert to JSONL format
    const jsonlContent = examples.map(example => JSON.stringify(example)).join('\n');

    await fs.writeFile(outputPath, jsonlContent, 'utf-8');

    this.logger.log(`Q&A training data saved to: ${outputPath}`, {
      examples: examples.length,
      size: jsonlContent.length
    });

    return outputPath;
  }

  /**
   * Validate Q&A training data quality
   */
  async validateQATrainingData(examples: FineTuneFormat[]): Promise<{
    valid: boolean;
    issues: string[];
    stats: {
      total: number;
      valid: number;
      invalid: number;
      validationRate: number;
    };
  }> {
    const issues: string[] = [];
    let validExamples = 0;

    for (let i = 0; i < examples.length; i++) {
      const example = examples[i];

      // Check required structure
      if (!example.messages || !Array.isArray(example.messages)) {
        issues.push(`Example ${i + 1}: Missing or invalid messages array`);
        continue;
      }

      if (example.messages.length !== 2) {
        issues.push(`Example ${i + 1}: Should have exactly 2 messages (user and assistant)`);
        continue;
      }

      const userMessage = example.messages.find(m => m.role === 'user');
      const assistantMessage = example.messages.find(m => m.role === 'assistant');

      if (!userMessage || !assistantMessage) {
        issues.push(`Example ${i + 1}: Missing user or assistant message`);
        continue;
      }

      if (!userMessage.content || userMessage.content.trim().length < 10) {
        issues.push(`Example ${i + 1}: User message too short or empty`);
        continue;
      }

      if (!assistantMessage.content || assistantMessage.content.trim().length < 20) {
        issues.push(`Example ${i + 1}: Assistant message too short or empty`);
        continue;
      }

      validExamples++;
    }

    const validationRate = examples.length > 0 ? validExamples / examples.length : 0;

    return {
      valid: issues.length === 0,
      issues,
      stats: {
        total: examples.length,
        valid: validExamples,
        invalid: examples.length - validExamples,
        validationRate
      }
    };
  }

  /**
   * Import CSV data directly to database
   */
  async importCSVToDatabase(csvFilePath: string): Promise<{
    importedPairs: number;
    stats: {
      totalExamples: number;
      byCategory: Record<string, number>;
      byEmotionalState: Record<string, number>;
    };
  }> {
    this.logger.log('Importing CSV data to database');

    try {
      // Load Q&A pairs from CSV
      const qaPairs = await this.loadFromCSVFile(csvFilePath);

      // Save to database
      let importedCount = 0;
      const stats = {
        totalExamples: 0,
        byCategory: {} as Record<string, number>,
        byEmotionalState: {} as Record<string, number>,
      };

      for (const qa of qaPairs) {
        try {
          // Save to database (replace with your actual database service method)
          // Prepare database entry with proper ID and structure
          const qaEntry = {
            id: `qa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            question: qa.question,
            answer: qa.answer,
            category: qa.category || 'imported',
            emotionalState: qa.emotionalState || 'neutral',
            difficulty: qa.difficulty || 'intermediate',
            source: typeof qa.source === 'string' ? qa.source : JSON.stringify(qa.source),
            importedAt: new Date().toISOString()
          };

          await this.databaseService.saveQAData(qaEntry);

          importedCount++;

          // Update stats
          const category = qa.category || 'unknown';
          stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

          const emotionalState = qa.emotionalState || 'neutral';
          stats.byEmotionalState[emotionalState] = (stats.byEmotionalState[emotionalState] || 0) + 1;

        } catch (error) {
          this.logger.warn(`Failed to save Q&A pair: ${qa.question}`, error);
        }
      }

      stats.totalExamples = importedCount;

      this.logger.log(`Successfully imported ${importedCount} Q&A pairs from CSV`);
      return {
        importedPairs: importedCount,
        stats
      };

    } catch (error) {
      this.logger.error('Failed to import CSV to database', error);
      throw error;
    }
  }

  /**
   * Process PDF document and extract Q&A training data
   */
  async processPDFDocument(pdfFilePath: string): Promise<{
    extractedText: string;
    generatedQAPairs: number;
    stats: {
      totalExamples: number;
      byCategory: Record<string, number>;
      byEmotionalState: Record<string, number>;
    };
  }> {
    this.logger.log('Processing PDF document for Q&A extraction');

    try {
      // Extract text from PDF (you'll need to install pdf-parse package)
      const extractedText = await this.extractTextFromPDF(pdfFilePath);

      // Generate Q&A pairs from the text using AI
      const qaPairs = await this.generateQAPairsFromText(extractedText);

      // Save to database
      let savedCount = 0;
      const stats = {
        totalExamples: 0,
        byCategory: {} as Record<string, number>,
        byEmotionalState: {} as Record<string, number>,
      };

      for (const qa of qaPairs) {
        try {
          await this.databaseService.saveQAData({
            question: qa.question,
            answer: qa.answer,
            category: qa.category || 'pdf_extracted',
            emotionalState: qa.emotionalState || 'neutral',
            difficulty: qa.difficulty || 'intermediate',
            source: {
              type: 'document',
              reference: `PDF: ${path.basename(pdfFilePath)}`,
              documentPath: pdfFilePath,
            }
          });

          savedCount++;

          // Update stats
          const category = qa.category || 'pdf_extracted';
          stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

          const emotionalState = qa.emotionalState || 'neutral';
          stats.byEmotionalState[emotionalState] = (stats.byEmotionalState[emotionalState] || 0) + 1;

        } catch (error) {
          this.logger.warn(`Failed to save PDF-extracted Q&A pair: ${qa.question}`, error);
        }
      }

      stats.totalExamples = savedCount;

      this.logger.log(`Successfully processed PDF and generated ${savedCount} Q&A pairs`);
      return {
        extractedText,
        generatedQAPairs: savedCount,
        stats
      };

    } catch (error) {
      this.logger.error('Failed to process PDF document', error);
      throw error;
    }
  }

  /**
   * Process PDF document and store as vectors for semantic search
   * Uses evidence-based chunking: embeds symptoms, returns evidence only
   */
  async processPDFWithVectors(pdfFilePath: string): Promise<{
    documentId: string;
    extractedText: string;
    chunksCreated: number;
    vectorsGenerated: number;
    indexedChunks: number;
  }> {
    this.logger.log('Processing PDF document with evidence-based vector storage');

    try {
      const documentId = `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Extract text from PDF
      const extractedText = await this.extractTextFromPDF(pdfFilePath);
      this.logger.log(`Extracted ${extractedText.length} characters from PDF`);

      // Create evidence-based chunks (search by symptoms, return evidence)
      const evidenceChunks = await this.evidenceChunkService.createEvidenceChunks(
        extractedText,
        path.basename(pdfFilePath)
      );

      this.logger.log(`Created ${evidenceChunks.length} evidence-based chunks`);

      let vectorsGenerated = 0;
      let indexedChunks = 0;

      // Process chunks with progress logging
      this.logger.log(`Starting to process ${evidenceChunks.length} chunks...`);
      const startTime = Date.now();

      for (const chunk of evidenceChunks) {
        try {
          // Generate embedding for the SEARCH TEXT (disease + symptoms)
          const embedding = await this.searchService.generateEmbedding(chunk.searchText);
          vectorsGenerated++;

          // Log progress every 10 chunks (since we have fewer chunks now)
          if (vectorsGenerated % 10 === 0 || vectorsGenerated === evidenceChunks.length) {
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            const rate = elapsed > 0 ? vectorsGenerated / elapsed : 0;
            const remaining = rate > 0 ? Math.round((evidenceChunks.length - vectorsGenerated) / rate) : 0;
            this.logger.log(`Progress: ${vectorsGenerated}/${evidenceChunks.length} chunks (${Math.round(vectorsGenerated/evidenceChunks.length*100)}%) - ETA: ${remaining}s`);
          }

          // Store in format compatible with SearchService
          const storageFormat = this.evidenceChunkService.formatForStorage(chunk);

          // Store chunk in database
          await this.databaseService.saveDocumentChunk(documentId, {
            id: chunk.id,
            documentId,
            chunkIndex: chunk.chunkIndex,
            text: chunk.searchText,  // For searching
            embedding,
            metadata: storageFormat.metadata,
          });

          // Index in search service for vector search
          try {
            await this.searchService.indexDocument({
              id: chunk.id,
              documentId,
              title: `${chunk.disease}${chunk.arabicName ? ` (${chunk.arabicName})` : ''}`,
              content: chunk.searchText,  // Symptoms for searching
              text: chunk.searchText,
              embedding,
              metadata: storageFormat.metadata,  // Includes evidenceText
            });
            indexedChunks++;
          } catch (indexError) {
            this.logger.warn(`Failed to index chunk ${chunk.chunkIndex}, continuing...`, indexError);
          }

        } catch (chunkError) {
          this.logger.error(`Failed to process chunk ${chunk.chunkIndex}:`, chunkError);
        }
      }

      const totalTime = Math.round((Date.now() - startTime) / 1000);
      this.logger.log(`Completed processing in ${totalTime}s (avg: ${(totalTime/evidenceChunks.length).toFixed(2)}s per chunk)`);

      // Save document metadata
      await this.databaseService.saveDocument({
        id: documentId,
        title: path.basename(pdfFilePath),
        type: 'pdf',
        content: extractedText.substring(0, 1000), // Store preview
        metadata: {
          originalName: path.basename(pdfFilePath),
          filePath: pdfFilePath,
          contentLength: extractedText.length,
          totalChunks: evidenceChunks.length,
          processedChunks: vectorsGenerated,
          indexedChunks,
          hasVectors: true,
          evidenceBased: true,  // Mark as evidence-based
        },
        uploadedAt: Date.now(),
        status: 'processed',
      });

      this.logger.log(`Successfully processed PDF: ${vectorsGenerated}/${evidenceChunks.length} evidence chunks with vectors, ${indexedChunks} indexed`);

      return {
        documentId,
        extractedText,
        chunksCreated: evidenceChunks.length,
        vectorsGenerated,
        indexedChunks,
      };

    } catch (error) {
      this.logger.error('Failed to process PDF with vectors', error);
      throw error;
    }
  }

  /**
   * Extract text from PDF file
   */
  private async extractTextFromPDF(pdfFilePath: string): Promise<string> {
    try {
      this.logger.log(`Extracting text from PDF: ${path.basename(pdfFilePath)}`);

      // Read PDF file as buffer
      const pdfBuffer = await fs.readFile(pdfFilePath);

      // Parse PDF and extract text
      const pdfData = await pdfParse(pdfBuffer);

      if (!pdfData.text || pdfData.text.trim().length === 0) {
        throw new Error('No text content found in PDF');
      }

      // Clean and normalize the extracted text
      const cleanedText = this.cleanExtractedText(pdfData.text);

      this.logger.log(`Successfully extracted ${cleanedText.length} characters from PDF`);
      this.logger.log(`PDF metadata: ${pdfData.numpages} pages, ${pdfData.numrender} rendered pages`);

      return cleanedText;
    } catch (error) {
      this.logger.error('Failed to extract text from PDF', error);
      throw error;
    }
  }

  /**
   * Clean and normalize extracted PDF text
   */
  private cleanExtractedText(text: string): string {
    return text
      // Remove excessive whitespace and normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      // Remove page headers/footers (common patterns)
      .replace(/^\d+\s*$/gm, '') // Page numbers on their own line
      .replace(/^Page \d+ of \d+$/gm, '') // "Page X of Y"
      // Clean up spacing
      .replace(/[ \t]{2,}/g, ' ') // Multiple spaces to single space
      .replace(/^\s+|\s+$/gm, '') // Trim lines
      .trim();
  }

  /**
   * Split text into chunks for vector processing
   */
  private createTextChunks(text: string, chunkSize: number = 1000, overlap: number = 200): {
    text: string;
    index: number;
    startPosition: number;
    endPosition: number;
  }[] {
    const chunks: {
      text: string;
      index: number;
      startPosition: number;
      endPosition: number;
    }[] = [];

    let startPosition = 0;
    let chunkIndex = 0;

    while (startPosition < text.length) {
      const endPosition = Math.min(startPosition + chunkSize, text.length);

      // Try to end at a sentence or paragraph break for better context
      let actualEndPosition = endPosition;
      if (endPosition < text.length) {
        // Look for natural break points
        const breakPoints = ['\n\n', '. ', '! ', '? '];
        let bestBreakPoint = -1;

        for (const breakPoint of breakPoints) {
          const breakIndex = text.lastIndexOf(breakPoint, endPosition);
          if (breakIndex > startPosition && breakIndex > bestBreakPoint) {
            bestBreakPoint = breakIndex + breakPoint.length;
          }
        }

        if (bestBreakPoint > startPosition) {
          actualEndPosition = bestBreakPoint;
        }
      }

      const chunkText = text.substring(startPosition, actualEndPosition).trim();

      if (chunkText.length > 50) { // Only include meaningful chunks
        chunks.push({
          text: chunkText,
          index: chunkIndex,
          startPosition,
          endPosition: actualEndPosition,
        });
        chunkIndex++;
      }

      // Move start position with overlap
      startPosition = Math.max(actualEndPosition - overlap, startPosition + 1);
    }

    return chunks;
  }

  /**
   * Generate Q&A pairs from extracted text using AI
   */
  private async generateQAPairsFromText(text: string): Promise<QATrainingExample[]> {
    const qaPairs: QATrainingExample[] = [];

    try {
      // Split text into paragraphs
      const paragraphs = text.split('\n\n').filter(p => p.trim().length > 50);

      // For each meaningful paragraph, try to extract or generate Q&A
      for (const paragraph of paragraphs.slice(0, 10)) { // Limit to first 10 paragraphs

        // Check if paragraph already contains Q&A pattern
        const qaMatch = paragraph.match(/Q:\s*(.+?)\s*A:\s*(.+)/s);
        if (qaMatch) {
          const question = qaMatch[1].trim();
          const answer = qaMatch[2].trim();

          if (question && answer) {
            const metadata = this.extractQAMetadata(question, answer);
            qaPairs.push({
              question,
              answer,
              category: metadata.category || 'pdf_extracted',
              emotionalState: metadata.emotionalState,
              difficulty: metadata.difficulty,
              source: {
                type: 'document',
                reference: 'PDF Extracted Q&A',
                originalQuestion: question
              }
            });
          }
        } else {
          // Generate potential questions from the content
          const generatedQAs = await this.generateQuestionsFromContent(paragraph);
          qaPairs.push(...generatedQAs);
        }
      }

      this.logger.log(`Generated ${qaPairs.length} Q&A pairs from PDF text`);
      return qaPairs;

    } catch (error) {
      this.logger.error('Failed to generate Q&A pairs from text', error);
      throw error;
    }
  }

  /**
   * Generate questions from content using AI or heuristics
   */
  private async generateQuestionsFromContent(content: string): Promise<QATrainingExample[]> {
    const qaPairs: QATrainingExample[] = [];

    try {
      // Simple heuristic approach - you can enhance this with AI
      const sentences = content.split('.').filter(s => s.trim().length > 20);

      for (const sentence of sentences.slice(0, 3)) { // Limit to 3 per paragraph
        const trimmedSentence = sentence.trim();
        if (trimmedSentence) {
          // Generate a potential question based on the content
          const question = this.generateQuestionFromStatement(trimmedSentence);

          if (question) {
            const metadata = this.extractQAMetadata(question, trimmedSentence);
            qaPairs.push({
              question,
              answer: trimmedSentence,
              category: 'generated_from_pdf',
              emotionalState: metadata.emotionalState,
              difficulty: metadata.difficulty,
              source: {
                type: 'document',
                reference: 'PDF Generated Q&A',
                originalQuestion: question
              }
            });
          }
        }
      }

      return qaPairs;

    } catch (error) {
      this.logger.error('Failed to generate questions from content', error);
      return [];
    }
  }

  /**
   * Generate a question from a statement
   */
  private generateQuestionFromStatement(statement: string): string | null {
    const statementLower = statement.toLowerCase();

    // Different question patterns based on content
    if (statementLower.includes('should') || statementLower.includes('must')) {
      return `What ${statement.replace(/\b(should|must)\b/gi, 'should')}?`;
    } else if (statementLower.includes('peace') || statementLower.includes('calm')) {
      return "How can I find peace in difficult situations?";
    } else if (statementLower.includes('prayer') || statementLower.includes('dua')) {
      return "How should I approach prayer when facing challenges?";
    } else if (statementLower.includes('allah') || statementLower.includes('god')) {
      return "How can I strengthen my relationship with Allah?";
    } else if (statementLower.includes('difficult') || statementLower.includes('challenge')) {
      return "How should I handle difficult times?";
    } else if (statementLower.includes('forgiveness') || statementLower.includes('forgive')) {
      return "How can I practice forgiveness?";
    } else if (statement.length > 30) {
      // Generic question for longer statements
      return "Can you explain more about this spiritual guidance?";
    }

    return null;
  }
}