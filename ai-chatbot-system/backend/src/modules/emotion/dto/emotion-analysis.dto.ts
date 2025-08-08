import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EmotionAnalysisDto {
  @ApiProperty({
    description: 'Text to analyze for emotion',
    example: 'I am very happy with the service!',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  text: string;
}