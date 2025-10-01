import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DocumentProcessor } from './document-processor.service';
import { QASplitterService } from './qa-splitter.service';
import { ClaudeTrainingService } from './claude-training.service';
import { StorageModule } from '../storage/storage.module';
import { SearchModule } from '../search/search.module';
import { DatabaseModule } from '../database/database.module';
import { BedrockModule } from '../bedrock/bedrock.module';
import { EvidenceChunkService } from '../spiritual-guidance/evidence-chunk.service';
import { EvidenceParserService } from '../spiritual-guidance/evidence-parser.service';

@Module({
  imports: [StorageModule, SearchModule, DatabaseModule, BedrockModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentProcessor,
    QASplitterService,
    ClaudeTrainingService,
    EvidenceChunkService,
    EvidenceParserService,
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}