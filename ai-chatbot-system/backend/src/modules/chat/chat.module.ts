import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { BedrockModule } from '../bedrock/bedrock.module';
import { EmotionModule } from '../emotion/emotion.module';
import { SearchModule } from '../search/search.module';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    ConfigModule,
    BedrockModule,
    EmotionModule,
    SearchModule,
    DatabaseModule,
    CacheModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}