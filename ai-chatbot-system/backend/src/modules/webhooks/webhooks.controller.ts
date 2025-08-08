import { Controller, Post, Body, Headers, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ChatService } from '../chat/chat.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly chatService: ChatService) {}

  @Post('zalo')
  @HttpCode(200)
  @ApiOperation({ summary: 'Zalo webhook endpoint' })
  async handleZaloWebhook(
    @Body() _body: any,
    @Headers('X-ZaloOA-Signature') _signature: string,
  ) {
    // Webhook handling would be implemented here
    return { status: 'ok' };
  }
}