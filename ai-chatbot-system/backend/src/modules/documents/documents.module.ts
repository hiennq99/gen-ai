import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DocumentProcessor } from './document-processor.service';
import { AdvancedTableExtractor } from './advanced-table-extractor.service';
import { QASplitterService } from './qa-splitter.service';
import { StorageModule } from '../storage/storage.module';
import { SearchModule } from '../search/search.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [StorageModule, SearchModule, DatabaseModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentProcessor, AdvancedTableExtractor, QASplitterService],
  exports: [DocumentsService, AdvancedTableExtractor],
})
export class DocumentsModule {}