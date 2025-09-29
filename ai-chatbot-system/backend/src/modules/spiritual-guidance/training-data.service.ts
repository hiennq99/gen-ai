import { Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { BedrockService } from "../bedrock/bedrock.service";
import * as fs from "fs/promises";
import * as path from "path";

export interface QATrainingExample {
  question: string;
  answer: string;
  category?: string;
  emotionalState?: string;
  keywords?: string[];
  difficulty?: "basic" | "intermediate" | "advanced";
  source?: string;
}

export interface FineTuneFormat {
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

@Injectable()
export class TrainingDataService {
  private readonly logger = new Logger(TrainingDataService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly bedrockService: BedrockService
  ) {}

  /**
   * Prepare pure Q&A training data for direct question-answer learning
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
    this.logger.log(
      "Starting Q&A training data preparation from database sources only"
    );

    const examples: FineTuneFormat[] = [];
    const stats = {
      totalExamples: 0,
      byCategory: {} as Record<string, number>,
      byEmotionalState: {} as Record<string, number>,
      byDifficulty: {} as Record<string, number>,
    };

    // Get ALL Q&A data from database (uploaded via CSV or admin interface)
    const qaExamples = await this.prepareExistingQAData();
    examples.push(...qaExamples);
    stats.byCategory["database_qa"] = qaExamples.length;

    stats.totalExamples = examples.length;

    // Count by emotional states and difficulty
    examples.forEach((example) => {
      const userMessage =
        example.messages.find((m) => m.role === "user")?.content || "";
      const assistantMessage =
        example.messages.find((m) => m.role === "assistant")?.content || "";
      const qaExample = this.extractQAMetadata(userMessage, assistantMessage);

      const emotionalState = qaExample.emotionalState || "neutral";
      stats.byEmotionalState[emotionalState] =
        (stats.byEmotionalState[emotionalState] || 0) + 1;

      const difficulty = qaExample.difficulty || "intermediate";
      stats.byDifficulty[difficulty] =
        (stats.byDifficulty[difficulty] || 0) + 1;
    });

    this.logger.log(
      "Q&A training data preparation completed from database sources",
      {
        totalExamples: stats.totalExamples,
        fromDatabase: stats.byCategory["database_qa"] || 0,
        fromDocuments: stats.byCategory["document_extracted"] || 0,
      }
    );

    return { examples, stats };
  }

  /**
   * Get existing Q&A data from database and convert to training format
   */
  private async prepareExistingQAData(): Promise<FineTuneFormat[]> {
    try {
      // Query existing Q&A data from DynamoDB
      const qaData = await this.databaseService.getQAData();
      const examples: FineTuneFormat[] = [];

      for (const item of qaData) {
        if (item.question && item.answer) {
          examples.push({
            messages: [
              { role: "user", content: item.question },
              { role: "assistant", content: item.answer },
            ],
          });
        }
      }

      return examples;
    } catch (error) {
      this.logger.warn(
        "Failed to fetch existing Q&A data from database",
        error
      );
      return [];
    }
  }

  private extractQAMetadata(
    question: string,
    answer: string
  ): QATrainingExample {
    const questionLower = question.toLowerCase();

    // Determine emotional state
    let emotionalState = "neutral";
    if (
      questionLower.includes("angry") ||
      questionLower.includes("mad") ||
      questionLower.includes("furious")
    ) {
      emotionalState = "anger";
    } else if (
      questionLower.includes("sad") ||
      questionLower.includes("depressed") ||
      questionLower.includes("hopeless")
    ) {
      emotionalState = "sadness";
    } else if (
      questionLower.includes("anxious") ||
      questionLower.includes("worried") ||
      questionLower.includes("scared")
    ) {
      emotionalState = "anxiety";
    } else if (
      questionLower.includes("lonely") ||
      questionLower.includes("alone") ||
      questionLower.includes("isolated")
    ) {
      emotionalState = "loneliness";
    }

    // Determine difficulty
    let difficulty: "basic" | "intermediate" | "advanced" = "intermediate";
    if (
      questionLower.includes("how do i") ||
      questionLower.includes("what should i")
    ) {
      difficulty = "basic";
    } else if (
      questionLower.includes("why") &&
      questionLower.includes("complex")
    ) {
      difficulty = "advanced";
    }

    // Extract keywords
    const keywords = questionLower
      .split(" ")
      .filter(
        (word) =>
          word.length > 3 &&
          ![
            "what",
            "how",
            "why",
            "when",
            "where",
            "should",
            "could",
            "would",
          ].includes(word)
      );

    return {
      question,
      answer,
      emotionalState,
      difficulty,
      keywords,
    };
  }

  /**
   * Add custom Q&A pairs to training data
   */
  async addCustomQAPairs(
    qaPairs: QATrainingExample[]
  ): Promise<FineTuneFormat[]> {
    const examples: FineTuneFormat[] = [];

    for (const qa of qaPairs) {
      examples.push({
        messages: [
          { role: "user", content: qa.question },
          { role: "assistant", content: qa.answer },
        ],
      });
    }

    return examples;
  }

  /**
   * Save training data to file for fine-tuning
   */
  async saveTrainingDataToFile(
    examples: FineTuneFormat[],
    filename: string = "spiritual_guidance_training.jsonl"
  ): Promise<string> {
    const outputPath = path.join(process.cwd(), "training-data", filename);

    // Ensure directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Convert to JSONL format (one JSON object per line)
    const jsonlContent = examples
      .map((example) => JSON.stringify(example))
      .join("\n");

    await fs.writeFile(outputPath, jsonlContent, "utf-8");

    this.logger.log(`Training data saved to ${outputPath}`, {
      examples: examples.length,
      fileSize: jsonlContent.length,
    });

    return outputPath;
  }

  /**
   * Validate training data quality
   */
  async validateTrainingData(examples: FineTuneFormat[]): Promise<{
    valid: boolean;
    issues: string[];
    stats: any;
  }> {
    const issues: string[] = [];
    let validExamples = 0;

    for (let i = 0; i < examples.length; i++) {
      const example = examples[i];

      // Check structure
      if (!example.messages || !Array.isArray(example.messages)) {
        issues.push(`Example ${i}: Missing or invalid messages array`);
        continue;
      }

      if (example.messages.length !== 2) {
        issues.push(
          `Example ${i}: Should have exactly 2 messages (user + assistant)`
        );
        continue;
      }

      const [userMsg, assistantMsg] = example.messages;

      if (userMsg.role !== "user" || assistantMsg.role !== "assistant") {
        issues.push(`Example ${i}: Invalid message roles`);
        continue;
      }

      if (!userMsg.content || !assistantMsg.content) {
        issues.push(`Example ${i}: Missing message content`);
        continue;
      }

      if (userMsg.content.length < 10 || assistantMsg.content.length < 50) {
        issues.push(`Example ${i}: Messages too short`);
        continue;
      }

      validExamples++;
    }

    return {
      valid: issues.length === 0,
      issues,
      stats: {
        total: examples.length,
        valid: validExamples,
        invalid: examples.length - validExamples,
        validationRate: validExamples / examples.length,
      },
    };
  }
}
