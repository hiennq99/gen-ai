import { Injectable, Logger } from '@nestjs/common';

export interface QAPair {
  question: string;
  answer: string;
  metadata?: {
    index?: number;
    category?: string;
    emotion?: string;
    originalDocument?: string;
  };
}

@Injectable()
export class QASplitterService {
  private readonly logger = new Logger(QASplitterService.name);

  /**
   * Detects if content contains Q&A format and splits it into individual pairs
   */
  detectAndSplitQA(content: string, documentTitle?: string): QAPair[] | null {
    // Try different Q&A detection patterns
    const patterns = [
      this.detectNumberedQA(content, documentTitle),
      this.detectQuestionAnswerFormat(content, documentTitle),
      this.detectFAQFormat(content, documentTitle),
      this.detectQColonAFormat(content, documentTitle),
    ];

    // Return the first successful detection
    for (const result of patterns) {
      if (result && result.length > 0) {
        this.logger.log(`Detected ${result.length} Q&A pairs in document`);
        return result;
      }
    }

    return null;
  }

  /**
   * Detects numbered Q&A format like:
   * 001. (Emotion) Question? Answer...
   * 002. (Emotion) Question? Answer...
   */
  private detectNumberedQA(content: string, documentTitle?: string): QAPair[] | null {
    const pattern = /(\d{3})\.\s*\(([^)]+)\)\s*([^?]+\?)\s*([\s\S]*?)(?=\d{3}\.\s*\(|$)/g;
    const matches = Array.from(content.matchAll(pattern));

    if (matches.length === 0) {
      return null;
    }

    return matches.map((match, index) => ({
      question: match[3].trim(),
      answer: match[4].trim(),
      metadata: {
        index: parseInt(match[1]),
        emotion: match[2].trim(),
        category: match[2].trim(),
        originalDocument: documentTitle,
      },
    }));
  }

  /**
   * Detects Q: A: format
   */
  private detectQuestionAnswerFormat(content: string, documentTitle?: string): QAPair[] | null {
    const pattern = /(?:Q:|Question:)\s*([^\n]+(?:\n(?!A:|Answer:)[^\n]+)*)\s*(?:A:|Answer:)\s*([\s\S]*?)(?=(?:Q:|Question:)|$)/gi;
    const matches = Array.from(content.matchAll(pattern));

    if (matches.length === 0) {
      return null;
    }

    return matches.map((match, index) => ({
      question: match[1].trim(),
      answer: match[2].trim(),
      metadata: {
        index: index + 1,
        originalDocument: documentTitle,
      },
    }));
  }

  /**
   * Detects FAQ format with questions ending in ? followed by answers
   */
  private detectFAQFormat(content: string, documentTitle?: string): QAPair[] | null {
    // Split by questions (lines ending with ?)
    const lines = content.split('\n');
    const qaPairs: QAPair[] = [];
    let currentQuestion = '';
    let currentAnswer = '';
    let inAnswer = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.endsWith('?')) {
        // Save previous Q&A pair if exists
        if (currentQuestion && currentAnswer) {
          qaPairs.push({
            question: currentQuestion,
            answer: currentAnswer.trim(),
            metadata: {
              index: qaPairs.length + 1,
              originalDocument: documentTitle,
            },
          });
        }
        
        // Start new question
        currentQuestion = trimmedLine;
        currentAnswer = '';
        inAnswer = true;
      } else if (inAnswer && trimmedLine) {
        // Continue building answer
        currentAnswer += (currentAnswer ? ' ' : '') + trimmedLine;
      }
    }

    // Save last Q&A pair
    if (currentQuestion && currentAnswer) {
      qaPairs.push({
        question: currentQuestion,
        answer: currentAnswer.trim(),
        metadata: {
          index: qaPairs.length + 1,
          originalDocument: documentTitle,
        },
      });
    }

    return qaPairs.length > 1 ? qaPairs : null;
  }

  /**
   * Detects Q: format where question and answer are separated by colon
   */
  private detectQColonAFormat(content: string, documentTitle?: string): QAPair[] | null {
    const sections = content.split(/\n\n+/);
    const qaPairs: QAPair[] = [];

    for (const section of sections) {
      // Check if section contains a question mark
      if (section.includes('?')) {
        const lines = section.split('\n');
        let question = '';
        let answer = '';
        let foundQuestion = false;

        for (const line of lines) {
          if (line.includes('?') && !foundQuestion) {
            question = line.trim();
            foundQuestion = true;
          } else if (foundQuestion) {
            answer += (answer ? ' ' : '') + line.trim();
          }
        }

        if (question && answer) {
          qaPairs.push({
            question: question.replace(/^\d+\.\s*/, ''), // Remove numbering if present
            answer: answer,
            metadata: {
              index: qaPairs.length + 1,
              originalDocument: documentTitle,
            },
          });
        }
      }
    }

    return qaPairs.length > 1 ? qaPairs : null;
  }

  /**
   * Validates if content is suitable for Q&A splitting
   */
  isQAContent(content: string): boolean {
    // Check for common Q&A indicators
    const indicators = [
      /\d{3}\.\s*\([^)]+\)/g, // Numbered format with emotions
      /(?:Q:|Question:)/gi,
      /(?:A:|Answer:)/gi,
      /FAQ/i,
      /frequently asked questions/i,
    ];

    // Count question marks
    const questionMarkCount = (content.match(/\?/g) || []).length;
    
    // If content has multiple questions, it might be Q&A format
    if (questionMarkCount >= 2) {
      return true;
    }

    // Check for any Q&A indicators
    return indicators.some(pattern => pattern.test(content));
  }

  /**
   * Formats Q&A pairs for better storage and retrieval
   */
  formatQAPair(qa: QAPair): string {
    let formatted = `Question: ${qa.question}\n\nAnswer: ${qa.answer}`;
    
    if (qa.metadata?.emotion) {
      formatted = `[${qa.metadata.emotion}] ${formatted}`;
    }
    
    if (qa.metadata?.category && qa.metadata.category !== qa.metadata?.emotion) {
      formatted = `Category: ${qa.metadata.category}\n${formatted}`;
    }
    
    return formatted;
  }
}