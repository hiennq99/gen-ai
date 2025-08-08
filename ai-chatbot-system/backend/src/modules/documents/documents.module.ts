import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DocumentProcessor } from './document-processor.service';
import { StorageModule } from '../storage/storage.module';
import { SearchModule } from '../search/search.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [StorageModule, SearchModule, DatabaseModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentProcessor],
  exports: [DocumentsService],
})
export class DocumentsModule {}