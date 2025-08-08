import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';
import { ThrottlerGuard } from '@nestjs/throttler';

@ApiTags('chat')
@Controller('chat')
@UseGuards(ThrottlerGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('message')
  @ApiOperation({ summary: 'Send a chat message' })
  @ApiResponse({ status: 200, description: 'Chat response', type: ChatResponseDto })
  async sendMessage(@Body() dto: ChatRequestDto) {
    return await this.chatService.processMessage({
      message: dto.message,
      sessionId: dto.sessionId,
      userId: dto.userId,
      metadata: dto.metadata,
    });
  }

  @Post('session/create')
  @ApiOperation({ summary: 'Create a new chat session' })
  @ApiBearerAuth()
  async createSession(@Body() body: { userId: string }) {
    return await this.chatService.createSession(body.userId);
  }

  @Post('session/:sessionId/end')
  @ApiOperation({ summary: 'End a chat session' })
  @ApiBearerAuth()
  async endSession(@Param('sessionId') sessionId: string) {
    await this.chatService.endSession(sessionId);
    return { success: true, sessionId };
  }
}