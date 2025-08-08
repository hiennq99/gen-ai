import { Module } from '@nestjs/common';
import { EmotionService } from './emotion.service';
import { EmotionController } from './emotion.controller';

@Module({
  controllers: [EmotionController],
  providers: [EmotionService],
  exports: [EmotionService],
})
export class EmotionModule {}