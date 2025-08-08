import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private activeConnections = new Map<string, string>();

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.activeConnections.set(client.id, new Date().toISOString());
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.activeConnections.delete(client.id);
  }

  @SubscribeMessage('message')
  async handleMessage(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.debug(`Received message from ${client.id}: ${data.message}`);
      
      // Send typing indicator
      client.emit('typing', { isTyping: true });

      const response = await this.chatService.processMessage({
        message: data.message,
        sessionId: data.sessionId,
        userId: data.userId,
        metadata: {
          channel: 'web',
          ...data.metadata,
        },
      });

      // Send response
      client.emit('response', response);
      client.emit('typing', { isTyping: false });
    } catch (error) {
      this.logger.error('Error processing WebSocket message:', error);
      client.emit('error', { message: 'Failed to process message' });
      client.emit('typing', { isTyping: false });
    }
  }

  @SubscribeMessage('stream')
  async handleStreamMessage(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      client.emit('stream-start');
      
      // Implementation for streaming responses
      // This would integrate with BedrockService.invokeModelStream
      
      client.emit('stream-end');
    } catch (error) {
      this.logger.error('Error in stream processing:', error);
      client.emit('stream-error', { message: 'Stream failed' });
    }
  }
}