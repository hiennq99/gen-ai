import { Controller, Get, Post, Delete, Param, Query, Body, Version } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';

@ApiTags('conversations')
@Controller({ path: 'conversations', version: '1' })
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all conversations with filters' })
  async getConversations(@Query() filters: any) {
    return await this.conversationsService.getConversations(filters);
  }

  @Get(':sessionId')
  @ApiOperation({ summary: 'Get specific conversation' })
  async getConversation(@Param('sessionId') sessionId: string) {
    return await this.conversationsService.getConversation(sessionId);
  }

  @Post('export')
  @ApiOperation({ summary: 'Export conversations' })
  async exportConversations(@Body() filters: any) {
    return await this.conversationsService.exportConversations(filters);
  }

  @Delete(':sessionId')
  @ApiOperation({ summary: 'Delete conversation' })
  async deleteConversation(@Param('sessionId') sessionId: string) {
    return await this.conversationsService.deleteConversation(sessionId);
  }
}