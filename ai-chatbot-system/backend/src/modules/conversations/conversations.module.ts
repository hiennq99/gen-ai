import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { DatabaseModule } from '../database/database.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [DatabaseModule, SearchModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}