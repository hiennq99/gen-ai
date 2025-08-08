import { IsString, IsNotEmpty, IsOptional, IsObject, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatRequestDto {
  @ApiProperty({
    description: 'The chat message from user',
    example: 'How can I improve my business strategy?',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message: string;

  @ApiPropertyOptional({
    description: 'Session ID for conversation continuity',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'User ID for personalization',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
  })
  @IsOptional()
  @IsObject()
  metadata?: {
    channel?: 'web' | 'zalo' | 'api';
    language?: 'en' | 'vi';
    deviceInfo?: any;
    exactMatch?: boolean;
    mode?: 'exact' | 'ai' | 'hybrid';
  };
}

export class ChatResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  content: string;

  @ApiPropertyOptional()
  media?: any[];

  @ApiProperty()
  emotion?: string;

  @ApiProperty()
  confidence: number;

  @ApiProperty()
  processingTime: number;

  @ApiPropertyOptional()
  metadata?: any;
}