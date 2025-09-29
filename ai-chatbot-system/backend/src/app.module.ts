import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ChatModule } from './modules/chat/chat.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { TrainingModule } from './modules/training/training.module';
import { EmotionModule } from './modules/emotion/emotion.module';
import { BedrockModule } from './modules/bedrock/bedrock.module';
import { DatabaseModule } from './modules/database/database.module';
import { StorageModule } from './modules/storage/storage.module';
import { CacheModule } from './modules/cache/cache.module';
import { QueueModule } from './modules/queue/queue.module';
import { SearchModule } from './modules/search/search.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SpiritualGuidanceModule } from './modules/spiritual-guidance/spiritual-guidance.module';
import { TestModule } from './modules/test/test.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    DatabaseModule,
    StorageModule,
    CacheModule,
    QueueModule,
    SearchModule,
    BedrockModule,
    EmotionModule,
    ChatModule,
    DocumentsModule,
    TrainingModule,
    AuthModule,
    HealthModule,
    ConversationsModule,
    SettingsModule,
    SpiritualGuidanceModule,
    TestModule,
  ],
})
export class AppModule {}