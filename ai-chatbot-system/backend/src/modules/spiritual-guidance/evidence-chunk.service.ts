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
      // Enhanced chapter detection - split by CHAPTER headers AND detect missing chapters by content patterns
      let chapterSections = documentText.split(/\n(?=CHAPTER\s+\d+)/);

      // Check for missing chapter boundaries and fix them
      chapterSections = this.fixMissingChapterBoundaries(chapterSections, documentText);

      const expectedChapters = chapterSections.filter(s => s.includes('CHAPTER')).length;

      this.logger.log(`Found ${expectedChapters} chapters in ${sourceFile} (after boundary correction)`);

      // Parse ALL evidence from entire document at once
      const allEvidence = this.evidenceParser.parseEvidence(documentText, sourceFile);

      this.logger.log(`Found ${allEvidence.length} evidence items by quote parsing in ${sourceFile}`);

      // ALWAYS use new Scholarly Evidence table extraction (disable fallback to old logic)
      const useGenericChunks = true; // Force use of new table extraction logic

      let chunkIndex = 0;

      for (const section of chapterSections) {
        // Skip empty sections
        if (!section || section.trim().length < 50) {
          continue;
        }

        // Get chapter/disease name
        // PDF structure: "CHAPTER X\n[optional arabic]\n[optional numbers]\nDISEASE NAME"
        const afterChapter = section.substring(0, 1000); // First 1000 chars for better coverage
        const chapterNumMatch = afterChapter.match(/CHAPTER\s*(\d+)/);

        if (!chapterNumMatch) {
          continue; // Skip if no CHAPTER number found
        }

        // Look through lines after CHAPTER to find disease name (title appears after "Chapter XX")
        const lines = afterChapter.split('\n');
        const chapterLineIdx = lines.findIndex(l => l.includes('CHAPTER'));

        let diseaseName = `Section ${chunkIndex + 1}`;

        // Extract the actual chapter title from lines immediately following "CHAPTER XX"
        const capitalLines: string[] = [];
        for (let i = chapterLineIdx + 1; i < Math.min(chapterLineIdx + 15, lines.length); i++) {
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

            // If we have a line that looks like a complete word (15+ chars OR ends with common suffixes AND is long enough), use it
            const looksComplete = line.length >= 15 ||
                                 (line.match(/ING$|NESS$|ANCE$|ITY$|HOOD$|SHIP$|MENT$/) && line.length >= 8);

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
          // FALLBACK: Extract evidence from 2-column table structure
          let rawEvidence = this.extractScholarlyEvidenceFromTable(section);

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

  /**
   * Extract ONLY from Scholarly Evidence tables with 2-column structure
   * Column 1: Conditions (skip bold text rows, only get normal text)
   * Column 2: Scholarly Evidence answers
   * Skip all other content outside these specific tables
   */
  private extractScholarlyEvidenceFromTable(text: string): string {
    const evidenceEntries: string[] = [];

    try {
      // Find all Scholarly Evidence tables in the text
      const tableMatches = this.findScholarlyEvidenceTables(text);

      if (tableMatches.length === 0) {
        this.logger.debug('No Scholarly Evidence tables found, skipping this section');
        return ''; // Skip if no Scholarly Evidence tables found
      }

      this.logger.log(`Found ${tableMatches.length} Scholarly Evidence table(s)`);

      for (let tableIndex = 0; tableIndex < tableMatches.length; tableIndex++) {
        const tableContent = tableMatches[tableIndex];
        this.logger.log(`🔍 Table ${tableIndex + 1} content preview (first 200 chars): "${tableContent.substring(0, 200)}..."`);

        const tableEntries = this.parseScholarlyEvidenceTable(tableContent);
        evidenceEntries.push(...tableEntries);
      }

      const result = evidenceEntries.join('\n\n---\n\n');
      this.logger.log(`Extracted ${evidenceEntries.length} condition-evidence pairs (${result.length} chars)`);
      return result;

    } catch (error) {
      this.logger.warn('Error extracting from Scholarly Evidence tables:', error);
      return ''; // Return empty instead of fallback
    }
  }

  /**
   * Merge broken text lines from PDF extraction
   * Combines short fragments like "A", "llāh", "s", "ays:" into "Allāh says:"
   */
  private mergeBrokenTextLines(lines: string[]): string[] {
    const merged: string[] = [];
    let currentLine = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip the header
      if (line.match(/Scholarly\s+Evidence/i)) {
        if (currentLine) {
          merged.push(currentLine.trim());
          currentLine = '';
        }
        merged.push(line);
        continue;
      }

      // If this is a very short line (1-3 chars), it's likely a fragment
      if (line.length <= 3) {
        currentLine += line;
      }
      // If this is a short line that might be continuing a word
      else if (line.length <= 10 && currentLine && !currentLine.endsWith(' ')) {
        currentLine += line;
      }
      // If we have accumulated content and this looks like a continuation
      else if (currentLine && line.length <= 15 && !line.match(/^[A-Z]/) && !line.includes(':')) {
        currentLine += ' ' + line;
      }
      // This looks like a new complete line
      else {
        if (currentLine) {
          merged.push(currentLine.trim());
        }
        currentLine = line;
      }
    }

    // Add any remaining content
    if (currentLine) {
      merged.push(currentLine.trim());
    }

    this.logger.log(`📝 Merged ${lines.length} broken lines into ${merged.length} complete lines`);
    return merged.filter(line => line.length > 0);
  }

  /**
   * Find all Scholarly Evidence tables in the text
   * Returns array of table content strings
   */
  private findScholarlyEvidenceTables(text: string): string[] {
    const tables: string[] = [];

    this.logger.log(`🔍 Searching for Scholarly Evidence tables in ${text.length} chars of text`);

    // Look for "Scholarly Evidence" headers followed by table-like content
    const tableHeaderPattern = /Scholarly\s+Evidence[\s\S]*?(?=(?:Treatment|Academic|CHAPTER|$))/gi;
    let match;
    let matchCount = 0;

    while ((match = tableHeaderPattern.exec(text)) !== null) {
      matchCount++;
      const tableContent = match[0];
      this.logger.log(`📋 Found potential table ${matchCount} (${tableContent.length} chars): "${tableContent.substring(0, 100)}..."`);

      // Verify this looks like a real table with 2-column structure
      if (this.isValidScholarlyEvidenceTable(tableContent)) {
        tables.push(tableContent);
        this.logger.log(`✅ Table ${matchCount} validated and added`);
      } else {
        this.logger.log(`❌ Table ${matchCount} failed validation`);
      }
    }

    this.logger.log(`🎯 Found ${tables.length} valid Scholarly Evidence tables out of ${matchCount} potential matches`);
    return tables;
  }

  /**
   * Check if the content is a valid Scholarly Evidence table
   */
  private isValidScholarlyEvidenceTable(content: string): boolean {
    // Must contain "Scholarly Evidence" header
    const hasHeader = !!content.match(/Scholarly\s+Evidence/i);
    this.logger.log(`🏷️  Validation: hasHeader=${hasHeader}`);

    if (!hasHeader) {
      return false;
    }

    // Must have some evidence indicators (Allah, Prophet, Quran, etc.)
    const evidenceIndicators = content.match(/(All[aā]h\s+says?|Prophet\s+said|Hadith|Qur[''']?[āa]n|Imām|Scholar)/gi);
    const hasEvidence = !!(evidenceIndicators && evidenceIndicators.length > 0);

    this.logger.log(`📚 Validation: hasEvidence=${hasEvidence} (found ${evidenceIndicators?.length || 0} indicators)`);
    if (evidenceIndicators) {
      this.logger.log(`📚 Evidence indicators found: ${evidenceIndicators.slice(0, 3).join(', ')}${evidenceIndicators.length > 3 ? '...' : ''}`);
    }

    return hasEvidence;
  }

  /**
   * Parse a single Scholarly Evidence table into condition-evidence pairs
   * Skip bold text rows in column 1, only get normal text conditions
   */
  private parseScholarlyEvidenceTable(tableContent: string): string[] {
    const entries: string[] = [];

    try {
      // Split into lines and clean them
      let lines = tableContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      // Fix broken text by merging short fragments
      lines = this.mergeBrokenTextLines(lines);

      this.logger.log(`📋 Parsing table with ${lines.length} lines. First 10 lines: ${lines.slice(0, 10).join(' | ')}`);

      // Skip the header line(s)
      let dataStartIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/Scholarly\s+Evidence/i)) {
          dataStartIndex = i + 1;
          this.logger.log(`📍 Found Scholarly Evidence header at line ${i}, starting data from line ${dataStartIndex}`);
          break;
        }
      }

      // Process table rows as pairs (condition + evidence)
      for (let i = dataStartIndex; i < lines.length; i++) {
        const line = lines[i];

        // Skip empty lines and section headers
        if (!line || this.isTableSectionHeader(line)) {
          this.logger.debug(`Skipping line ${i}: "${line}" (empty or header)`);
          continue;
        }

        this.logger.debug(`Processing line ${i}: "${line}"`);

        // Try to extract condition-evidence pair from this line and subsequent lines
        const entry = this.extractConditionEvidencePair(lines, i);
        if (entry) {
          entries.push(entry.text);
          i = entry.nextIndex - 1; // Skip processed lines
          this.logger.debug(`Found entry, moving to line ${entry.nextIndex}`);
        }
      }

      this.logger.log(`Parsed ${entries.length} condition-evidence pairs from table`);
      return entries;

    } catch (error) {
      this.logger.warn('Error parsing Scholarly Evidence table:', error);
      return [];
    }
  }

  /**
   * Check if a line is a table section header (to skip)
   */
  private isTableSectionHeader(line: string): boolean {
    return line.match(/^(Scholarly\s+Evidence|Treatment|Academic|Evidence|CHAPTER)/i) !== null;
  }

  /**
   * Extract a condition-evidence pair from table lines
   * Returns the formatted entry and the next index to process
   */
  private extractConditionEvidencePair(lines: string[], startIndex: number): {text: string, nextIndex: number} | null {
    let condition = '';
    let evidence = '';
    let i = startIndex;

    this.logger.debug(`extractConditionEvidencePair starting at line ${startIndex}: "${lines[startIndex]?.substring(0, 50)}..."`);

    // Look for the condition (first column - skip if bold text)
    while (i < lines.length) {
      const line = lines[i];

      // Stop if we hit a new section or another condition starts
      if (this.isTableSectionHeader(line) || this.looksLikeNewCondition(line, i > startIndex)) {
        this.logger.debug(`Stopping condition search at line ${i}: section header or new condition`);
        break;
      }

      // Skip bold text rows in first column (usually uppercase or header-like)
      if (this.isBoldTextRow(line)) {
        this.logger.debug(`Skipping bold text row: "${line.substring(0, 50)}..."`);
        i++;
        continue;
      }

      // Check if this line contains a condition (normal text)
      if (this.isConditionText(line) && !condition) {
        condition = line;
        this.logger.debug(`Found condition: "${condition.substring(0, 50)}..."`);
        i++;
        break; // Move to look for evidence
      } else {
        this.logger.debug(`Line ${i} not condition text: "${line.substring(0, 50)}..."`);
      }

      i++;
    }

    // Look for the evidence (second column - scholarly evidence content)
    while (i < lines.length) {
      const line = lines[i];

      // Stop if we hit a new section or another condition starts
      if (this.isTableSectionHeader(line) || this.looksLikeNewCondition(line, true)) {
        this.logger.debug(`Stopping evidence search at line ${i}: section header or new condition`);
        break;
      }

      // Collect evidence content (references to Allah, Prophet, Quran, etc.)
      if (this.isScholarlyEvidenceContent(line)) {
        evidence += (evidence ? ' ' : '') + line;
        this.logger.debug(`Added evidence from line ${i}: "${line.substring(0, 30)}..." (total: ${evidence.length} chars)`);
      } else {
        this.logger.debug(`Line ${i} not evidence content: "${line.substring(0, 50)}..."`);
      }

      i++;

      // Stop collecting if we have substantial evidence content
      if (evidence.length > 200) {
        this.logger.debug(`Stopping evidence collection - reached 200+ chars`);
        break;
      }
    }

    this.logger.debug(`Extraction result: condition=${condition ? 'YES' : 'NO'} (${condition.length} chars), evidence=${evidence ? 'YES' : 'NO'} (${evidence.length} chars)`);

    // More lenient requirements - the text merging is working well
    if (condition && evidence && condition.length > 5 && evidence.length > 20) {
      const formattedEntry = `**Condition:** ${condition}\n\n**Scholarly Evidence:** ${evidence}`;
      this.logger.log(`✅ Created condition-evidence pair: "${condition.substring(0, 50)}..." -> "${evidence.substring(0, 50)}..."`);
      return {
        text: formattedEntry,
        nextIndex: i
      };
    }

    // Debug why no pair was created
    this.logger.log(`❌ No pair created: condition="${condition ? 'YES' : 'NO'}" (${condition?.length || 0} chars), evidence="${evidence ? 'YES' : 'NO'}" (${evidence?.length || 0} chars)`);
    return null;
  }

  /**
   * Check if a line contains bold text (usually uppercase or header-like)
   */
  private isBoldTextRow(line: string): boolean {
    // Skip lines that are mostly uppercase (likely bold headers)
    const uppercaseRatio = (line.match(/[A-Z]/g) || []).length / line.length;
    if (uppercaseRatio > 0.7) {
      return true;
    }

    // Skip lines that look like headers
    if (line.match(/^(SIGNS?|SYMPTOMS?|EVIDENCE|TREATMENT|CONDITIONS?)/i)) {
      return true;
    }

    return false;
  }

  /**
   * Check if a line contains condition text (normal text for conditions)
   */
  private isConditionText(line: string): boolean {
    // Skip very short lines
    if (line.length < 5) {
      return false;
    }

    // Must be normal text (not mostly uppercase)
    const uppercaseRatio = (line.match(/[A-Z]/g) || []).length / line.length;
    if (uppercaseRatio > 0.8) { // More lenient - was 0.7
      return false;
    }

    // Skip obvious evidence content
    if (this.isScholarlyEvidenceContent(line)) {
      return false;
    }

    // Look for condition patterns like "Lacking Certainty in Allāh"
    const isConditionTitle = line.match(/(lacking|having|feeling|experiencing|being|showing|in|of|with|without)\s+\w+/i) !== null;

    // Or general descriptive text that's not evidence
    const isSentenceLike = line.length > 10 && !!line.match(/[a-z]/) && !line.includes('says') && !line.includes('Prophet');

    this.logger.log(`🔍 isConditionText("${line}"): isConditionTitle=${isConditionTitle}, isSentenceLike=${isSentenceLike}, uppercaseRatio=${uppercaseRatio.toFixed(2)}`);

    return isConditionTitle || isSentenceLike;
  }

  /**
   * Check if a line contains scholarly evidence content
   */
  private isScholarlyEvidenceContent(line: string): boolean {
    const hasEvidenceMarkers = line.match(/(All[aā]h\s+says?|Prophet\s+said|Hadith|Qur[''']?[āa]n|Imām|Scholar|Academic|Reference|says\s+in|according\s+to|verses?|chapter|surah)/i) !== null;

    // Also consider quoted text or verse references as evidence
    const hasQuotes = line.includes('"') || line.includes('"') || line.includes('"');
    const hasVerseRef = line.match(/\[\w+-\w+\s+\d+:\d+\]/i) !== null; // [Al-Mu'minūn 23:117]

    const isEvidence = hasEvidenceMarkers || hasQuotes || hasVerseRef;
    this.logger.log(`🔍 isScholarlyEvidenceContent("${line.substring(0, 50)}..."): hasEvidenceMarkers=${hasEvidenceMarkers}, hasQuotes=${hasQuotes}, hasVerseRef=${hasVerseRef}, result=${isEvidence}`);

    return isEvidence;
  }

  /**
   * Check if a line looks like it starts a new condition
   */
  private looksLikeNewCondition(line: string, hasSeenContent: boolean): boolean {
    if (!hasSeenContent) {
      return false;
    }

    // If we see "you feel/have/experience" it's likely a new condition
    return line.match(/\b(?:you\s+(?:feel|have|experience|become|show)|feeling|experiencing)/i) !== null;
  }


  /**
   * Fix missing chapter boundaries by detecting internal chapter patterns
   * Handles cases where CHAPTER headers are missing in PDF extraction
   */
  private fixMissingChapterBoundaries(sections: string[], fullText: string): string[] {
    const fixedSections: string[] = [];

    for (const section of sections) {
      // Check if this section might contain multiple chapters
      const internalChapters = this.detectInternalChapterBoundaries(section);

      if (internalChapters.length > 1) {
        this.logger.log(`Found ${internalChapters.length} internal chapters in section`);
        fixedSections.push(...internalChapters);
      } else {
        fixedSections.push(section);
      }
    }

    return fixedSections;
  }

  /**
   * Detect chapter boundaries within a section based on content patterns
   * Looks for disease names and content patterns that indicate new chapters
   */
  private detectInternalChapterBoundaries(text: string): string[] {
    const sections: string[] = [];

    // Known chapter patterns and disease names from the spiritual guidance handbook
    const chapterPatterns = [
      // Common disease/condition patterns that start new chapters
      /(?:^|\n\n+)([A-Z][A-Z\s]{10,50})\s*\n+(?:Signs?\s*&?\s*Symptoms?|You\s+(?:feel|experience|have)|Description:|الأعراض)/im,

      // Specific diseases mentioned by user
      /(?:^|\n\n+)(INIQUITY|BAGHI|باغي)\s*\[.*?\]?\s*\n/im,
      /(?:^|\n\n+)(LOVE\s+OF\s+THE\s+WORLD|حب\s+الدنيا)\s*\n/im,
      /(?:^|\n\n+)(WITHDRAWAL\s+OF\s+ALLAH|انسحاب\s+الله)\s*\n/im,

      // General patterns for spiritual conditions
      /(?:^|\n\n+)([A-Z][A-Z\s&'-]{8,40})\s*\n+(?=.*(?:Signs|Symptoms|Evidence|Qur|Prophet|Treatment))/im
    ];

    let currentPos = 0;
    let lastSectionEnd = 0;

    // Find all potential chapter boundaries
    const boundaries: Array<{pos: number, title: string}> = [];

    for (const pattern of chapterPatterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags + 'g');

      while ((match = regex.exec(text)) !== null) {
        const title = match[1]?.trim();
        if (title && title.length > 5) {
          boundaries.push({
            pos: match.index,
            title: title
          });
        }
      }
    }

    // Sort boundaries by position
    boundaries.sort((a, b) => a.pos - b.pos);

    // Remove duplicate/overlapping boundaries
    const uniqueBoundaries = boundaries.filter((boundary, index) => {
      if (index === 0) return true;
      const prevBoundary = boundaries[index - 1];
      return boundary.pos - prevBoundary.pos > 200; // Must be at least 200 chars apart
    });

    this.logger.log(`Found ${uniqueBoundaries.length} potential chapter boundaries`);

    if (uniqueBoundaries.length <= 1) {
      // No internal boundaries found, return original text
      return [text];
    }

    // Split text at boundaries
    for (let i = 0; i < uniqueBoundaries.length; i++) {
      const boundary = uniqueBoundaries[i];
      const nextBoundary = uniqueBoundaries[i + 1];

      const startPos = i === 0 ? 0 : boundary.pos;
      const endPos = nextBoundary ? nextBoundary.pos : text.length;

      const sectionText = text.substring(startPos, endPos).trim();

      if (sectionText.length > 100) { // Only include substantial sections
        this.logger.log(`Creating section for: "${boundary.title}" (${sectionText.length} chars)`);
        sections.push(sectionText);
      }
    }

    return sections.length > 0 ? sections : [text];
  }
}