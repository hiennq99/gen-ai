import { Injectable, Logger } from '@nestjs/common';
import { EvidenceParserService, DiseaseEvidence, Evidence, EvidenceType } from './evidence-parser.service';

/**
 * Evidence-based chunk for vector storage
 * Search input: disease + symptoms
 * Return output: evidence only
 */
export interface EvidenceChunk {
  id: string;
  disease: string;
  arabicName?: string;

  // For SEARCH (embedding input)
  searchText: string; // disease + symptoms

  // For RETURN (retrieval output)
  evidenceText: string; // formatted evidence
  structuredEvidence: Evidence[];

  // Metadata
  type: 'evidence';
  chunkIndex: number;
  sourceFile: string;
  pageNumber?: number;
}

/**
 * Service to create evidence-based chunks
 * Strategy: Embed symptoms, return evidence
 */
@Injectable()
export class EvidenceChunkService {
  private readonly logger = new Logger(EvidenceChunkService.name);

  constructor(
    private readonly evidenceParser: EvidenceParserService,
  ) {}

  /**
   * Create evidence chunks from handbook text
   * SIMPLIFIED: Extract ALL quotes from entire document, group by chapters
   */
  async createEvidenceChunks(
    documentText: string,
    sourceFile: string,
  ): Promise<EvidenceChunk[]> {
    const chunks: EvidenceChunk[] = [];

    try {
      // Split document into chapters first
      const chapterSections = documentText.split(/\n(?=CHAPTER\s+\d+)/);
      const expectedChapters = chapterSections.filter(s => s.includes('CHAPTER')).length;

      this.logger.log(`Found ${expectedChapters} chapters in ${sourceFile}`);

      // Parse ALL evidence from entire document at once
      const allEvidence = this.evidenceParser.parseEvidence(documentText, sourceFile);

      this.logger.log(`Found ${allEvidence.length} evidence items by quote parsing in ${sourceFile}`);

      // FALLBACK: If quote parsing fails (< 10 evidence items for a multi-chapter document), use raw text extraction
      const useGenericChunks = allEvidence.length < 10;

      let chunkIndex = 0;

      for (const section of chapterSections) {
        // Skip empty sections
        if (!section || section.trim().length < 50) {
          continue;
        }

        // Get chapter/disease name
        // PDF structure: "CHAPTER X\n[optional arabic]\n[optional numbers]\nDISEASE NAME"
        const afterChapter = section.substring(0, 600); // First 600 chars
        const chapterNumMatch = afterChapter.match(/CHAPTER\s*(\d+)/);

        if (!chapterNumMatch) {
          continue; // Skip if no CHAPTER number found
        }

        // Look through lines after CHAPTER to find disease name
        const lines = afterChapter.split('\n');
        const chapterLineIdx = lines.findIndex(l => l.includes('CHAPTER'));

        let diseaseName = `Section ${chunkIndex + 1}`;

        // Check next 10 lines after CHAPTER line, collecting capital letter lines
        const capitalLines: string[] = [];
        for (let i = chapterLineIdx + 1; i < Math.min(chapterLineIdx + 11, lines.length); i++) {
          const line = lines[i].trim();

          // Skip empty lines, arabic text, and numbers
          if (!line || line.match(/^[\d\s]+$/) || line.match(/[أ-ي]/)) {
            continue;
          }

          // Collect lines with capital letters (even 2-letter fragments like "FA")
          if (line.match(/^[A-Z\s&'-]+$/)) {
            // Skip section headings
            if (line.match(/SIGNS|SYMPTOMS|EVIDENCE|QUR|PROPHETIC|ACADEMIC|TREATMENT|CHAPTER/)) {
              break; // Stop collecting when we hit section headings
            }

            capitalLines.push(line);

            // If we have a line that looks like a complete word (12+ chars OR ends with common suffixes), use it
            const looksComplete = line.length >= 12 ||
                                 line.match(/ING$|NESS$|ANCE$|ITY$|HOOD$|SHIP$|MENT$/);

            if (looksComplete) {
              diseaseName = line
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/[AF]$/, '');  // Remove trailing A or F
              this.logger.log(`Found disease name "${diseaseName}" in line: "${line}"`);
              break;
            }
          } else if (capitalLines.length > 0) {
            // Hit a non-capital line after collecting some capitals - combine them
            break;
          }
        }

        // If we collected multiple short capital lines, combine them
        if (diseaseName.startsWith('Section') && capitalLines.length > 0) {
          diseaseName = capitalLines.join('')  // "FA" + "NTASIZING" -> "FANTASIZING"
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/[AF]$/, '');  // Remove trailing A or F
          this.logger.log(`Combined disease name from ${capitalLines.length} lines: "${diseaseName}"`);
        }

        this.logger.log(`Processing chapter ${chapterNumMatch[1]}: "${diseaseName}"`);

        let sectionEvidence: Evidence[];
        let evidenceText: string;

        if (useGenericChunks) {
          // FALLBACK: Extract evidence section text directly
          const evidenceMatch = section.match(/(?:Qur[''']?[āa]nic|Prophetic)[^\n]*[\s\S]{100,3000}?(?=(?:Academic|Treatment|CHAPTER|$))/i);
          const rawEvidence = evidenceMatch ? evidenceMatch[0] : '';

          this.logger.log(`Fallback mode: Found ${rawEvidence.length} chars of raw evidence for "${diseaseName}"`);

          if (!rawEvidence || rawEvidence.length < 100) {
            this.logger.warn(`Skipping "${diseaseName}" - insufficient evidence text (${rawEvidence.length} chars)`);
            continue; // Skip if no evidence section found
          }

          // Clean up raw evidence text
          evidenceText = this.cleanEvidenceText(rawEvidence);
          sectionEvidence = []; // Empty for generic
          this.logger.log(`Using ${evidenceText.length} chars of cleaned evidence for "${diseaseName}"`);
        } else {
          // Find evidence items that appear in this section
          sectionEvidence = allEvidence.filter(e =>
            section.includes(e.text.substring(0, 50)) || // Match by quote text
            section.includes(e.reference) // Or by reference
          );

          if (sectionEvidence.length === 0) {
            continue; // Skip sections with no evidence
          }

          // Format evidence text (what will be returned)
          evidenceText = this.evidenceParser.formatEvidence(sectionEvidence, 'vi');
        }

        // Extract symptoms/description from this section
        const symptomsMatch = section.match(/Signs?\s*&\s*Symptoms?[\s\S]{0,100}?([\s\S]{100,1000}?)(?=Qur|Prophetic|Evidence|$)/i);
        const symptoms = symptomsMatch ? symptomsMatch[1].trim() : `Symptoms for ${diseaseName}`;

        // Create search text (what user will search with)
        const searchText = this.createSearchText(diseaseName, symptoms);

        // Create chunk
        const chunk: EvidenceChunk = {
          id: `evidence-${sourceFile}-${chunkIndex}`,
          disease: diseaseName,
          searchText,
          evidenceText,
          structuredEvidence: sectionEvidence,
          type: 'evidence',
          chunkIndex,
          sourceFile,
        };

        chunks.push(chunk);
        chunkIndex++;

        this.logger.log(`Created evidence chunk for "${diseaseName}" with ${sectionEvidence.length} evidence items`);
      }

      this.logger.log(`Created ${chunks.length} evidence chunks from ${sourceFile}`);

    } catch (error) {
      this.logger.error('Error creating evidence chunks:', error);
    }

    return chunks;
  }

  /**
   * Split document into disease sections
   * Works with both markdown and plain text PDFs
   */
  private splitIntoDiseases(text: string): string[] {
    // Try markdown format first (# Disease Name)
    let sections = text.split(/\n(?=#\s+[A-Z])/);

    // If no markdown sections found, try splitting by CHAPTER
    if (sections.length <= 1) {
      sections = text.split(/\n(?=CHAPTER\s+\d+)/);
      this.logger.log(`Split by CHAPTER pattern, found ${sections.length} chapters`);
    }

    // Filter sections that have both symptoms/description and evidence
    this.logger.debug(`Found ${sections.length} potential sections before filtering`);

    const filtered = sections.filter((section, index) => {
      // More flexible symptom detection
      const hasSymptoms = section.includes('Signs & Symptoms') ||
                         section.includes('Signs and Symptoms') ||
                         section.includes('Symptoms') ||
                         section.includes('SIGNS &') ||
                         section.includes('SYMPTOMS') ||
                         section.match(/:\s*You\s+/i); // Description pattern

      // More flexible evidence detection
      const hasEvidence = section.includes('Evidence') ||
                         section.includes('EVIDENCE') ||
                         section.includes('Qur') ||
                         section.includes('Prophet') ||
                         section.includes('Allah says') ||
                         section.includes('Allāh says') ||
                         section.includes('Allāh ') || // Just Allah with space
                         section.includes('Hadith') ||
                         section.includes('Imam') ||
                         section.includes('Imām') ||
                         section.includes('Musnad') || // Hadith collection
                         section.includes('Sunan') ||  // Hadith collection
                         section.includes('Sahih');    // Hadith collection

      if (!hasSymptoms || !hasEvidence) {
        this.logger.log(`Section ${index} filtered out: hasSymptoms=${hasSymptoms}, hasEvidence=${hasEvidence}`);
        this.logger.log(`Section title: ${section.split('\n')[0]}`);
      }

      return hasSymptoms && hasEvidence;
    });

    this.logger.debug(`${filtered.length} sections passed filter`);
    return filtered;
  }

  /**
   * Create search text from disease and symptoms
   * This is what gets embedded for vector search
   */
  private createSearchText(
    disease: string,
    symptoms: string,
    arabicName?: string,
  ): string {
    const parts: string[] = [];

    // Add disease name
    parts.push(`Disease: ${disease}`);

    // Add Arabic name if available
    if (arabicName) {
      parts.push(`Arabic: ${arabicName}`);
    }

    // Add symptoms (cleaned)
    const cleanedSymptoms = this.cleanSymptoms(symptoms);
    parts.push(`Symptoms: ${cleanedSymptoms}`);

    // Add alternative phrasings for better search
    const searchVariations = this.generateSearchVariations(disease, cleanedSymptoms);
    parts.push(...searchVariations);

    return parts.join('\n\n');
  }

  /**
   * Clean symptoms text
   */
  private cleanSymptoms(symptoms: string): string {
    return symptoms
      // Remove bullet points
      .replace(/^[-•*]\s*/gm, '')
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove page numbers
      .replace(/\[p\.\s*\d+\]/g, '')
      .trim();
  }

  /**
   * Generate search variations for better matching
   */
  private generateSearchVariations(disease: string, symptoms: string): string[] {
    const variations: string[] = [];

    // Add question variations
    variations.push(`How to deal with ${disease.toLowerCase()}`);
    variations.push(`How to control ${disease.toLowerCase()}`);
    variations.push(`Treatment for ${disease.toLowerCase()}`);
    variations.push(`Cure for ${disease.toLowerCase()}`);

    // Add specific symptom-based queries
    const symptomKeywords = this.extractKeywords(symptoms);
    symptomKeywords.forEach(keyword => {
      variations.push(`I feel ${keyword}`);
      variations.push(`I have ${keyword}`);
    });

    return variations;
  }

  /**
   * Extract keywords from symptoms
   */
  private extractKeywords(text: string): string[] {
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];

    const words = text
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3 && !stopWords.includes(word));

    // Return top keywords
    return [...new Set(words)].slice(0, 10);
  }

  /**
   * Clean evidence text extracted from PDF
   * Fixes broken formatting from table extraction
   */
  private cleanEvidenceText(text: string): string {
    return text
      // Fix broken words with newlines: "F\norgetfulness" -> "Forgetfulness"
      .replace(/([A-Z])\n([a-z])/g, '$1$2')
      // Fix broken words with spaces at word boundaries: "Y our" -> "Your", "Th e" -> "The"
      .replace(/\b([A-Z])\s+([a-z]{2,})/g, '$1$2')
      // Fix broken single letters at start: "F orgetfulness" -> "Forgetfulness"
      .replace(/\n([A-Z])\s+([a-z])/g, '\n$1$2')
      // Normalize multiple newlines to double newline (paragraph breaks)
      .replace(/\n{3,}/g, '\n\n')
      // Remove single newlines within sentences (but keep double newlines for paragraphs)
      .replace(/([^\n])\n([^\n])/g, '$1 $2')
      // Normalize multiple spaces
      .replace(/\s{2,}/g, ' ')
      // Fix broken Quranic references like "[A\nl-Baqarah" -> "[Al-Baqarah"
      .replace(/\[A\s*\nl-/g, '[Al-')
      .replace(/\[A\s+l-/g, '[Al-')
      // Remove page numbers
      .replace(/\[p\.\s*\d+\]/g, '')
      .trim();
  }

  /**
   * Format chunk for storage
   */
  formatForStorage(chunk: EvidenceChunk): any {
    return {
      id: chunk.id,
      disease: chunk.disease,
      arabicName: chunk.arabicName,

      // What gets embedded
      content: chunk.searchText,
      text: chunk.searchText,

      // What gets returned (stored in metadata)
      metadata: {
        type: chunk.type,
        disease: chunk.disease,
        arabicName: chunk.arabicName,
        evidenceText: chunk.evidenceText,
        structuredEvidence: JSON.stringify(chunk.structuredEvidence),
        sourceFile: chunk.sourceFile,
        chunkIndex: chunk.chunkIndex,

        // Add evidence type markers for filtering
        hasQuran: chunk.structuredEvidence.some(e => e.type === EvidenceType.QURAN),
        hasHadith: chunk.structuredEvidence.some(e => e.type === EvidenceType.HADITH),
        hasScholar: chunk.structuredEvidence.some(e => e.type === EvidenceType.SCHOLAR),
        evidenceCount: chunk.structuredEvidence.length,
      },
    };
  }

  /**
   * Reconstruct chunk from stored data
   */
  reconstructFromStorage(storedData: any): EvidenceChunk {
    return {
      id: storedData.id,
      disease: storedData.metadata.disease,
      arabicName: storedData.metadata.arabicName,
      searchText: storedData.content,
      evidenceText: storedData.metadata.evidenceText,
      structuredEvidence: JSON.parse(storedData.metadata.structuredEvidence || '[]'),
      type: 'evidence',
      chunkIndex: storedData.metadata.chunkIndex,
      sourceFile: storedData.metadata.sourceFile,
      pageNumber: storedData.metadata.pageNumber,
    };
  }

  /**
   * Filter only evidence chunks from search results
   */
  filterEvidenceResults(results: any[]): any[] {
    return results.filter(result =>
      result.metadata?.type === 'evidence' &&
      result.metadata?.evidenceCount > 0
    );
  }

  /**
   * Format evidence for user display
   */
  formatEvidenceForDisplay(chunk: EvidenceChunk, language: 'en' | 'vi' = 'vi'): string {
    return chunk.evidenceText;
  }
}