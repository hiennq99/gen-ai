import { Injectable, Logger } from '@nestjs/common';
import pdfParse from 'pdf-parse';

export interface ExtractedQA {
  disease: string;
  question: string;
  answer: {
    type: 'quranic' | 'hadith' | 'scholarly' | 'none';
    text: string;
    reference?: string;
    full_context?: string;
  };
  metadata: {
    category: string;
    section_index: number;
    total_symptoms: number;
    total_evidences: number;
  };
}

export interface AdvancedExtractionResult {
  qaList: ExtractedQA[];
  metadata: {
    totalPages: number;
    textLength: number;
    sectionsFound: number;
    extractedAt: string;
  };
}

@Injectable()
export class AdvancedTableExtractor {
  private readonly logger = new Logger(AdvancedTableExtractor.name);

  async extractTableData(pdfBuffer: Buffer): Promise<AdvancedExtractionResult> {
    const data = await pdfParse(pdfBuffer);

    this.logger.log(`📄 Total pages: ${data.numpages}`);
    this.logger.log(`📝 Total text length: ${data.text.length}`);

    const qaList = this.parseStructuredTables(data.text);

    return {
      qaList,
      metadata: {
        totalPages: data.numpages,
        textLength: data.text.length,
        sectionsFound: qaList.length > 0 ? Math.max(...qaList.map(qa => qa.metadata.section_index)) + 1 : 0,
        extractedAt: new Date().toISOString()
      }
    };
  }

  private parseStructuredTables(fullText: string): ExtractedQA[] {
    const qaList: ExtractedQA[] = [];

    // Find all sections with "Signs & Symptoms"
    const sections = fullText.split(/(?=\d+\s*\n+[A-Z][^n]+\n+SIGNS & SYMPTOMS)/gi);

    this.logger.log(`Found ${sections.length} potential sections`);

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      // Skip sections that are too short
      if (section.length < 100) continue;

      // Extract disease name
      const diseaseMatch = section.match(/^\d+\s*\n+([A-Z][^\n]+)\n+SIGNS & SYMPTOMS/i);
      if (!diseaseMatch) continue;

      const disease = diseaseMatch[1].trim();
      this.logger.log(`🔍 Processing: ${disease}`);

      // Find "Signs & Symptoms" section until "Qur'ānic" or "TREATMENTS"
      const symptomsMatch = section.match(/SIGNS & SYMPTOMS\s+([\s\S]*?)(?:Qur'ānic, Prophetic|TREATMENTS|EXCEPTIONS|$)/i);

      if (!symptomsMatch) {
        this.logger.warn('⚠️  No symptoms section found');
        continue;
      }

      const symptomsSection = symptomsMatch[1];

      // Extract symptoms (column 1)
      const symptoms = this.extractColumn1Symptoms(symptomsSection);
      this.logger.log(`✅ Found ${symptoms.length} symptoms`);

      // Extract evidences (column 2)
      const evidenceMatch = section.match(/Qur'ānic, Prophetic\s*&\s*Scholarly Evidence\s+([\s\S]*?)(?:TREATMENTS|EXCEPTIONS|$)/i);

      let evidences: Array<{type: 'quranic' | 'hadith' | 'scholarly' | 'none', text: string, reference?: string, full_context?: string}> = [];
      if (evidenceMatch) {
        evidences = this.extractColumn2Evidence(evidenceMatch[1]);
        this.logger.log(`✅ Found ${evidences.length} evidences`);
      }

      // Pair symptoms with evidences
      symptoms.forEach((symptom, idx) => {
        qaList.push({
          disease,
          question: symptom,
          answer: evidences[idx] || evidences[0] || { type: 'none', text: 'No evidence found' },
          metadata: {
            category: 'signs_symptoms',
            section_index: idx,
            total_symptoms: symptoms.length,
            total_evidences: evidences.length
          }
        });
      });
    }

    return qaList;
  }

  private extractColumn1Symptoms(text: string): string[] {
    const symptoms: string[] = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

    let currentSymptom = '';

    for (const line of lines) {
      // Skip if it's evidence (contains Allāh, Prophet, references)
      if (this.isEvidence(line)) {
        continue;
      }

      // If it's a header (short, no period at end)
      if (this.isSymptomHeader(line)) {
        if (currentSymptom) {
          symptoms.push(currentSymptom.trim());
        }
        currentSymptom = line;
      } else {
        // Append to current symptom
        currentSymptom += ' ' + line;
      }
    }

    if (currentSymptom) {
      symptoms.push(currentSymptom.trim());
    }

    return symptoms.filter(s => s.length > 15);
  }

  private isSymptomHeader(line: string): boolean {
    return line.length < 80
      && line.length > 5
      && !line.includes('"')
      && !line.match(/\[[\w\s'-]+\d+:/);
  }

  private isEvidence(line: string): boolean {
    return line.includes('Allāh')
      || line.includes('Prophet')
      || line.includes('Imām')
      || !!line.match(/\[[\w\s'-]+\d+:/);
  }

  private extractColumn2Evidence(text: string): Array<{type: 'quranic' | 'hadith' | 'scholarly' | 'none', text: string, reference?: string, full_context?: string}> {
    const evidences: Array<{type: 'quranic' | 'hadith' | 'scholarly' | 'none', text: string, reference?: string, full_context?: string}> = [];

    // Extract Quranic verses
    const quranPattern = /Allāh\s+[^\n]*says:\s*\n?\s*o?\s*"([^"]+)"[^[]*(\[[^\]]+\])?/gi;
    let match;

    while ((match = quranPattern.exec(text)) !== null) {
      evidences.push({
        type: 'quranic',
        text: match[1].trim(),
        reference: match[2] ? match[2].trim() : '',
        full_context: match[0].replace(/\n/g, ' ').replace(/\s+/g, ' ')
      });
    }

    // Extract Hadith
    const hadithPattern = /The Prophet\s+[^\n]*said[,:]?\s*\n?\s*o?\s*"([^"]+)"[^[]*(\[[^\]]+\])?/gi;

    while ((match = hadithPattern.exec(text)) !== null) {
      evidences.push({
        type: 'hadith',
        text: match[1].trim(),
        reference: match[2] ? match[2].trim() : '',
        full_context: match[0].replace(/\n/g, ' ').replace(/\s+/g, ' ')
      });
    }

    // Extract Scholar quotes
    const scholarPattern = /Imām\s+[\w-]+\s+[^\n]*said[,:]?\s*"([^"]+)"/gi;

    while ((match = scholarPattern.exec(text)) !== null) {
      evidences.push({
        type: 'scholarly',
        text: match[1].trim(),
        reference: '',
        full_context: match[0].replace(/\n/g, ' ').replace(/\s+/g, ' ')
      });
    }

    return evidences;
  }

  // Utility method to convert extracted QA to simple text format
  convertQAToText(qaList: ExtractedQA[]): string {
    let result = '';

    qaList.forEach((item, index) => {
      result += `Entry ${index + 1}:\n`;
      result += `Disease: ${item.disease}\n`;
      result += `Question: ${item.question}\n`;
      result += `Answer Type: ${item.answer.type}\n`;
      result += `Answer: ${item.answer.text}\n`;
      if (item.answer.reference) {
        result += `Reference: ${item.answer.reference}\n`;
      }
      result += `Category: ${item.metadata.category}\n`;
      result += '---\n\n';
    });

    return result;
  }

  // Export extracted data as JSON
  exportAsJSON(qaList: ExtractedQA[]): string {
    return JSON.stringify(qaList, null, 2);
  }

  // Export extracted data as CSV
  exportAsCSV(qaList: ExtractedQA[]): string {
    const csvRows = [
      'Disease,Question,Answer Type,Answer Text,Reference'
    ];

    qaList.forEach(item => {
      const question = item.question.replace(/"/g, '""');
      const answerText = (item.answer.text || '').replace(/"/g, '""');
      const reference = (item.answer.reference || '').replace(/"/g, '""');

      csvRows.push(
        `"${item.disease}","${question}","${item.answer.type}","${answerText}","${reference}"`
      );
    });

    return csvRows.join('\n');
  }
}