import { Injectable, Logger } from '@nestjs/common';
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

@Injectable()
export class DocumentProcessor {
  private readonly logger = new Logger(DocumentProcessor.name);

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

  private async extractPdfContent(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      this.logger.error('Error parsing PDF:', error);
      throw new Error('Failed to extract PDF content');
    }
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
}