import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [ChatModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}