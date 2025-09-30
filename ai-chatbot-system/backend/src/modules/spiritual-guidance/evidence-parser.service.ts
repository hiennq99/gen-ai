import { Injectable, Logger } from '@nestjs/common';

/**
 * Evidence types from Islamic sources
 */
export enum EvidenceType {
  QURAN = 'Quran',
  HADITH = 'Hadith',
  SCHOLAR = 'Scholar',
}

/**
 * Structured evidence item
 */
export interface Evidence {
  type: EvidenceType;
  text: string;
  reference: string;
  scholar?: string;
  page?: number;
}

/**
 * Parsed disease evidence structure
 */
export interface DiseaseEvidence {
  disease: string;
  arabicName?: string;
  symptoms: string;
  evidence: Evidence[];
  rawEvidenceText: string;
}

/**
 * Service to parse spiritual disease evidence from documents
 * Extracts only Qur'ānic, Prophetic & Scholarly Evidence
 */
@Injectable()
export class EvidenceParserService {
  private readonly logger = new Logger(EvidenceParserService.name);

  /**
   * Regex patterns for evidence extraction
   */
  private readonly patterns = {
    // Quran pattern: Allāh says, "quote" [Reference]
    // More flexible: allows newlines, bullet points (o), optional punctuation
    quran: /(?:Allāh|Allah)\s+(?:says?|said)\s*:?\s*[\n\s]*[o•]?\s*["']([^"']+)["']\s*\[([^\]]+)\]/gi,

    // Hadith pattern: The Prophet said, "quote" [Reference]
    hadith: /(?:The\s+)?Prophet(?:\s+Muhammad)?\s+(?:ﷺ|peace be upon him)?\s+(?:says?|said)\s*:?\s*[\n\s]*["']([^"']+)["']\s*\[([^\]]+)\]/gi,

    // Scholar pattern: Imam/Scholar name said, "quote" [Reference]
    scholar: /(?:Im[āaĀ]m|Imam|Scholar)\s+([^"']+?)\s+(?:says?|said)\s*:?\s*[\n\s]*["']([^"']+)["']\s*\[([^\]]+)\]/gi,

    // Alternative Quran pattern with verse reference
    quranVerse: /["']([^"']+)["']\s*\[(?:Qur[''']?[āa]n|Surah|Al-)([^\]]+)\]/gi,

    // Page reference
    pageRef: /\[([^\]]*?p\.?\s*(\d+)[^\]]*?)\]/gi,
  };

  /**
   * Parse evidence text into structured format
   * SIMPLIFIED: Extract ALL quotes with references, classify later
   */
  parseEvidence(evidenceText: string, diseaseName: string): Evidence[] {
    const evidences: Evidence[] = [];

    try {
      // UNIVERSAL PATTERN: Find ANY quote followed by a reference in brackets
      // Format: "any text here" [Reference Here]
      // Allow newlines inside quotes ([\s\S] matches everything including newlines)
      const universalPattern = /"([\s\S]{15,500}?)"\s*\[([^\]]+)\]/g;
      const allMatches = Array.from(evidenceText.matchAll(universalPattern));

      this.logger.log(`Found ${allMatches.length} total quotes with references for ${diseaseName}`);

      for (const match of allMatches) {
        const quote = match[1].trim().replace(/\s+/g, ' '); // Normalize whitespace
        const reference = match[2].trim().replace(/\s+/g, ' ');

        // Classify based on reference format
        let type: EvidenceType;

        if (this.isQuranReference(reference)) {
          type = EvidenceType.QURAN;
        } else if (this.isHadithReference(reference)) {
          type = EvidenceType.HADITH;
        } else {
          // Default to Scholar if has page reference or book name
          type = EvidenceType.SCHOLAR;
        }

        evidences.push({
          type,
          text: quote,
          reference,
        });
      }

      this.logger.log(`Parsed ${evidences.length} evidence items for ${diseaseName} (classified from quotes with references)`);

    } catch (error) {
      this.logger.error(`Error parsing evidence for ${diseaseName}:`, error);
    }

    return evidences;
  }

  /**
   * Extract Qur'anic evidence
   * More lenient: finds quotes near [Al-Surah X:Y] patterns
   */
  private extractQuranEvidence(text: string): Evidence[] {
    const evidences: Evidence[] = [];

    // Pattern 1: Allāh says, "quote" [Reference]
    const matches1 = Array.from(text.matchAll(this.patterns.quran));
    for (const match of matches1) {
      evidences.push({
        type: EvidenceType.QURAN,
        text: this.cleanQuote(match[1]),
        reference: this.cleanReference(match[2]),
      });
    }

    // Pattern 2: "quote" [Qur'ān/Surah Reference]
    const matches2 = Array.from(text.matchAll(this.patterns.quranVerse));
    for (const match of matches2) {
      const ref = match[2];
      // Only add if reference looks like Quran (contains surah name or number)
      if (this.isQuranReference(ref)) {
        evidences.push({
          type: EvidenceType.QURAN,
          text: this.cleanQuote(match[1]),
          reference: this.cleanReference(ref),
        });
      }
    }

    // Pattern 3: More lenient - find ANY quote followed by [Al-Something X:Y]
    // This handles broken text like: "quote" [A\nl-Baqarah 2:216]
    const lenientPattern = /"([^"]{20,}?)"\s*\[([A\s]*l-[^\]]+?\d+[:\d]*)\]/gs;
    const matches3 = Array.from(text.matchAll(lenientPattern));
    for (const match of matches3) {
      const quote = this.cleanQuote(match[1]);
      const ref = match[2].replace(/\s+/g, ' ').trim(); // Clean up spaces

      // Avoid duplicates
      const isDuplicate = evidences.some(e => e.text === quote);
      if (!isDuplicate && ref.match(/l-\w+/)) {
        evidences.push({
          type: EvidenceType.QURAN,
          text: quote,
          reference: ref,
        });
      }
    }

    return evidences;
  }

  /**
   * Extract Hadith evidence
   */
  private extractHadithEvidence(text: string): Evidence[] {
    const evidences: Evidence[] = [];

    const matches = Array.from(text.matchAll(this.patterns.hadith));
    for (const match of matches) {
      evidences.push({
        type: EvidenceType.HADITH,
        text: this.cleanQuote(match[1]),
        reference: this.cleanReference(match[2]),
      });
    }

    // Alternative pattern: Look for hadith book references with lenient matching
    // Handles: "quote" [Sahih...], "quote" [Musnad...], etc.
    const hadithBookPattern = /"([^"]{20,}?)"\s*\[(Sahih|Sunan|Musnad|Jami)[^\]]+\]/gis;
    const bookMatches = Array.from(text.matchAll(hadithBookPattern));
    for (const match of bookMatches) {
      const quote = this.cleanQuote(match[1]);
      // Avoid duplicates
      const isDuplicate = evidences.some(e => e.text === quote);
      if (!isDuplicate) {
        evidences.push({
          type: EvidenceType.HADITH,
          text: quote,
          reference: this.cleanReference(match[0].match(/\[([^\]]+)\]/)?.[1] || match[2]),
        });
      }
    }

    return evidences;
  }

  /**
   * Extract Scholar evidence
   */
  private extractScholarEvidence(text: string): Evidence[] {
    const evidences: Evidence[] = [];

    const matches = Array.from(text.matchAll(this.patterns.scholar));
    for (const match of matches) {
      const scholarName = this.cleanScholarName(match[1]);
      evidences.push({
        type: EvidenceType.SCHOLAR,
        text: this.cleanQuote(match[2]),
        reference: this.cleanReference(match[3]),
        scholar: scholarName,
      });
    }

    return evidences;
  }

  /**
   * Check if reference is Qur'anic
   */
  private isQuranReference(ref: string): boolean {
    const quranKeywords = ['qur', 'surah', 'al-', 'an-', 'baqarah', 'imran', 'nisa', 'luqman', 'ankab'];
    const refLower = ref.toLowerCase();
    return quranKeywords.some(keyword => refLower.includes(keyword)) ||
           !!ref.match(/\d+:\d+/); // Has verse format X:Y
  }

  /**
   * Check if reference is Hadith
   */
  private isHadithReference(ref: string): boolean {
    const hadithKeywords = ['sahih', 'sunan', 'musnad', 'bukhari', 'muslim', 'tirmidhi', 'nasa', 'dawud', 'ahmad'];
    const refLower = ref.toLowerCase();
    return hadithKeywords.some(keyword => refLower.includes(keyword));
  }

  /**
   * Clean quote text
   */
  private cleanQuote(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'");
  }

  /**
   * Clean reference
   */
  private cleanReference(ref: string): string {
    return ref.trim().replace(/\s+/g, ' ');
  }

  /**
   * Clean scholar name
   */
  private cleanScholarName(name: string): string {
    return name
      .trim()
      .replace(/^(Imām|Imam|Scholar)\s+/i, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Format evidence for display
   */
  formatEvidence(evidences: Evidence[], language: 'en' | 'vi' = 'vi'): string {
    const sections: string[] = [];

    // Group by type
    const quranEvidences = evidences.filter(e => e.type === EvidenceType.QURAN);
    const hadithEvidences = evidences.filter(e => e.type === EvidenceType.HADITH);
    const scholarEvidences = evidences.filter(e => e.type === EvidenceType.SCHOLAR);

    // Qur'an section
    if (quranEvidences.length > 0) {
      quranEvidences.forEach(e => {
        sections.push(`"${e.text}" [${e.reference}]`);
      });
      sections.push('');
    }

    // Hadith section
    if (hadithEvidences.length > 0) {
      hadithEvidences.forEach(e => {
        sections.push(`"${e.text}" [${e.reference}]`);
      });
      sections.push('');
    }

    // Scholar section
    if (scholarEvidences.length > 0) {
      scholarEvidences.forEach(e => {
        if (e.scholar) {
          sections.push(`${e.scholar}: "${e.text}" [${e.reference}]`);
        } else {
          sections.push(`"${e.text}" [${e.reference}]`);
        }
      });
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Parse disease structure from chunk
   */
  parseDiseaseChunk(chunkText: string): DiseaseEvidence | null {
    try {
      // Extract disease name (works with both markdown and plain text)
      let diseaseMatch = chunkText.match(/^#\s+([^\n]+)/m);

      // If no markdown heading, try to find disease name at start of text
      if (!diseaseMatch) {
        // Get first non-empty line as disease name
        const firstLine = chunkText.split('\n').find(line => line.trim().length > 0);
        if (!firstLine || firstLine.length > 100) {
          return null; // Not a valid disease section
        }
        diseaseMatch = [firstLine, firstLine];
      }

      const diseaseName = diseaseMatch[1].trim();

      // Extract Arabic name if present
      const arabicMatch = chunkText.match(/[أ-ي]+/);
      const arabicName = arabicMatch ? arabicMatch[0] : undefined;

      // Extract symptoms section (works with both formats)
      let symptomsMatch = chunkText.match(/##\s+Signs?\s+&\s+Symptoms?\s*\n([\s\S]*?)(?=##|$)/i);

      // Try plain text format: "Signs & Symptoms" as regular heading
      if (!symptomsMatch) {
        symptomsMatch = chunkText.match(/Signs?\s+&\s+Symptoms?\s*[:\n]+([\s\S]*?)(?=\n(?:Qur|Prophetic|Evidence|Academic|Treatment)|$)/i);
      }

      const symptoms = symptomsMatch ? symptomsMatch[1].trim() : '';

      // Extract evidence section (works with both formats)
      let evidenceMatch = chunkText.match(/##\s+(?:Qur[''']?[āa]nic|Prophetic|Scholarly|Evidence)[\s\S]*?\n([\s\S]*?)(?=##\s+(?:Academic|Treatment)|$)/i);

      // Try plain text format - look for "Qur'ānic, Prophetic" heading
      if (!evidenceMatch) {
        evidenceMatch = chunkText.match(/(?:Qur[''']?[āa]nic[,\s]+Prophetic|Prophetic\s+&\s+Scholarly|Evidence)[\s\S]{0,50}?\n([\s\S]*?)(?=(?:Academic|Treatment|TREATMENTS|$))/i);
      }

      // If still not found, extract everything between symptoms and treatment sections
      if (!evidenceMatch) {
        const afterSymptoms = chunkText.split(/Signs?\s*&\s*S[^\n]*\n/i)[1];
        if (afterSymptoms) {
          const beforeTreatment = afterSymptoms.split(/(?:Academic|Treatment|TREATMENTS)/i)[0];
          if (beforeTreatment) {
            evidenceMatch = ['', beforeTreatment.trim()];
          }
        }
      }

      const rawEvidenceText = evidenceMatch ? (evidenceMatch[1] || evidenceMatch[0] || '').trim() : '';

      // Parse evidence into structured format
      const evidence = this.parseEvidence(rawEvidenceText, diseaseName);

      return {
        disease: diseaseName,
        arabicName,
        symptoms,
        evidence,
        rawEvidenceText,
      };

    } catch (error) {
      this.logger.error('Error parsing disease chunk:', error);
      return null;
    }
  }

  /**
   * Extract only evidence section from chunk
   * This is used for indexing - we want to search by symptoms but return evidence
   */
  extractEvidenceOnly(chunkText: string): string {
    const evidenceMatch = chunkText.match(/##\s+(?:Qur[''']?[āa]nic|Prophetic|Scholarly|Evidence)[\s\S]*?\n([\s\S]*?)(?=##\s+(?:Academic|Treatment)|$)/i);
    return evidenceMatch ? evidenceMatch[1].trim() : '';
  }

  /**
   * Check if text contains evidence (not symptoms or treatment)
   */
  isEvidenceText(text: string): boolean {
    const evidenceIndicators = [
      'Allāh says',
      'Allah says',
      'Prophet said',
      'Imam',
      'Qur\'ān',
      'Quran',
      'Hadith',
      '[Sahih',
      '[Sunan',
    ];

    return evidenceIndicators.some(indicator =>
      text.includes(indicator)
    );
  }
}