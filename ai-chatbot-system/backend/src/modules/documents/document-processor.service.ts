import { Injectable, Logger } from '@nestjs/common';
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import { AdvancedTableExtractor, AdvancedExtractionResult } from './advanced-table-extractor.service';

@Injectable()
export class DocumentProcessor {
  private readonly logger = new Logger(DocumentProcessor.name);
  private readonly advancedExtractor = new AdvancedTableExtractor();

  async extractContent(file: Express.Multer.File): Promise<string> {
    try {
      switch (file.mimetype) {
        case 'application/pdf':
          return await this.extractPdfContent(file.buffer);

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return await this.extractDocxContent(file.buffer);

        case 'text/plain':
          return file.buffer.toString('utf-8');

        case 'application/json':
          return this.extractJsonContent(file.buffer);

        default:
          throw new Error(`Unsupported file type: ${file.mimetype}`);
      }
    } catch (error) {
      this.logger.error('Error extracting content:', error);
      throw error;
    }
  }

  async extractContentWithMetadata(file: Express.Multer.File): Promise<{content: string, metadata: any}> {
    try {
      switch (file.mimetype) {
        case 'application/pdf':
          return await this.extractPdfContentWithPages(file.buffer, file.originalname);

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          const docxContent = await this.extractDocxContent(file.buffer);
          return { content: docxContent, metadata: { pages: [] } };

        case 'text/plain':
          const textContent = file.buffer.toString('utf-8');
          return { content: textContent, metadata: { pages: [] } };

        case 'application/json':
          const jsonContent = this.extractJsonContent(file.buffer);
          return { content: jsonContent, metadata: { pages: [] } };

        default:
          throw new Error(`Unsupported file type: ${file.mimetype}`);
      }
    } catch (error) {
      this.logger.error('Error extracting content with metadata:', error);
      throw error;
    }
  }

  private async extractPdfContent(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      this.logger.error('Error parsing PDF:', error);
      throw new Error('Failed to extract PDF content');
    }
  }

  private async extractPdfContentWithPages(buffer: Buffer, filename: string): Promise<{content: string, metadata: any}> {
    try {
      const data = await pdfParse(buffer);

      // Basic estimation of page breaks and content organization
      const pages = this.estimatePageBreaks(data.text, data.numpages);

      this.logger.log(`📄 Extracted PDF "${filename}": ${data.numpages} pages, ${data.text.length} characters`);

      return {
        content: data.text,
        metadata: {
          filename,
          totalPages: data.numpages,
          pages: pages,
          documentType: 'pdf',
          extractedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      this.logger.error('Error parsing PDF with page metadata:', error);
      throw new Error('Failed to extract PDF content with page information');
    }
  }

  private estimatePageBreaks(text: string, totalPages: number): Array<{page: number, startIndex: number, content: string}> {
    const pages: Array<{page: number, startIndex: number, content: string}> = [];

    // Simple approach: divide text roughly by page count
    const avgCharsPerPage = Math.ceil(text.length / totalPages);
    const lines = text.split('\n');

    let currentPage = 1;
    let currentContent = '';
    let currentCharCount = 0;
    let startIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentContent += line + '\n';
      currentCharCount += line.length + 1;

      // Check for explicit page breaks or character threshold
      if (
        currentCharCount >= avgCharsPerPage &&
        currentPage < totalPages &&
        (line.trim() === '' || line.match(/^\s*\d+\s*$/) || line.includes('Chapter') || line.includes('Page'))
      ) {
        pages.push({
          page: currentPage,
          startIndex: startIndex,
          content: currentContent.trim()
        });

        currentPage++;
        startIndex += currentCharCount;
        currentContent = '';
        currentCharCount = 0;
      }
    }

    // Add remaining content as last page(s)
    if (currentContent.trim()) {
      pages.push({
        page: currentPage,
        startIndex: startIndex,
        content: currentContent.trim()
      });
    }

    return pages;
  }

  private async extractDocxContent(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      this.logger.error('Error parsing DOCX:', error);
      throw new Error('Failed to extract DOCX content');
    }
  }

  private extractJsonContent(buffer: Buffer): string {
    try {
      const json = JSON.parse(buffer.toString('utf-8'));
      
      // Handle different JSON structures
      if (Array.isArray(json)) {
        return json.map(item => this.extractTextFromObject(item)).join('\n\n');
      } else if (typeof json === 'object') {
        return this.extractTextFromObject(json);
      } else {
        return String(json);
      }
    } catch (error) {
      this.logger.error('Error parsing JSON:', error);
      throw new Error('Failed to extract JSON content');
    }
  }

  private extractTextFromObject(obj: any, prefix = ''): string {
    let text = '';
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        text += `${prefix}${key}: ${value}\n`;
      } else if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          text += `${prefix}${key}:\n`;
          value.forEach((item) => {
            if (typeof item === 'string') {
              text += `${prefix}  - ${item}\n`;
            } else {
              text += this.extractTextFromObject(item, `${prefix}  `);
            }
          });
        } else {
          text += `${prefix}${key}:\n`;
          text += this.extractTextFromObject(value, `${prefix}  `);
        }
      } else {
        text += `${prefix}${key}: ${value}\n`;
      }
    }
    
    return text;
  }

  async preprocessContent(content: string): Promise<string> {
    // Clean and normalize content
    let processed = content;

    // Remove excessive whitespace
    processed = processed.replace(/\s+/g, ' ');

    // Remove special characters that might affect processing
    processed = processed.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

    // Normalize line breaks
    processed = processed.replace(/\r\n/g, '\n');
    processed = processed.replace(/\r/g, '\n');

    // Remove excessive line breaks
    processed = processed.replace(/\n{3,}/g, '\n\n');

    return processed.trim();
  }

  async extractAdvancedPdfContent(file: Express.Multer.File): Promise<AdvancedExtractionResult> {
    try {
      this.logger.log(`🔍 Starting advanced PDF extraction for: ${file.originalname}`);

      const result = await this.advancedExtractor.extractTableData(file.buffer);

      this.logger.log(`✅ Advanced extraction completed: ${result.qaList.length} Q&A pairs extracted`);
      this.logger.log(`📊 Metadata: ${result.metadata.totalPages} pages, ${result.metadata.sectionsFound} sections`);

      return result;
    } catch (error) {
      this.logger.error('Error in advanced PDF extraction:', error);
      throw new Error('Failed to perform advanced PDF content extraction');
    }
  }

  async extractAdvancedPdfContentAsText(file: Express.Multer.File): Promise<string> {
    try {
      const result = await this.extractAdvancedPdfContent(file);
      return this.advancedExtractor.convertQAToText(result.qaList);
    } catch (error) {
      this.logger.error('Error converting advanced PDF content to text:', error);
      throw error;
    }
  }

  async extractAdvancedPdfContentAsJSON(file: Express.Multer.File): Promise<string> {
    try {
      const result = await this.extractAdvancedPdfContent(file);
      return this.advancedExtractor.exportAsJSON(result.qaList);
    } catch (error) {
      this.logger.error('Error converting advanced PDF content to JSON:', error);
      throw error;
    }
  }

  async extractAdvancedPdfContentAsCSV(file: Express.Multer.File): Promise<string> {
    try {
      const result = await this.extractAdvancedPdfContent(file);
      return this.advancedExtractor.exportAsCSV(result.qaList);
    } catch (error) {
      this.logger.error('Error converting advanced PDF content to CSV:', error);
      throw error;
    }
  }
}