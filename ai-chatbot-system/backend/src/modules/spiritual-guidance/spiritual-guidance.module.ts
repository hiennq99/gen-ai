import { Module } from '@nestjs/common';
import { SpiritualGuidanceService } from './spiritual-guidance.service';
import { SpiritualGuidanceController } from './spiritual-guidance.controller';
import { CitationService } from './citation.service';
import { EmotionMappingService } from './emotion-mapping.service';
import { QualityControlService } from './quality-control.service';
import { DocumentSearchService } from './document-search.service';
import { SpiritualGuidanceAdminController } from './admin/spiritual-guidance-admin.controller';
import { SpiritualGuidanceAdminService } from './admin/spiritual-guidance-admin.service';
import { TrainingDataService } from './training-data.service';
import { QATrainingService } from './qa-training.service';
import { SourceTrackingService } from './source-tracking.service';
import { FineTunedGuidanceService } from './fine-tuned-guidance.service';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { BedrockModule } from '../bedrock/bedrock.module';
import { EmotionModule } from '../emotion/emotion.module';

@Module({
  imports: [DatabaseModule, CacheModule, BedrockModule, EmotionModule],
  controllers: [SpiritualGuidanceController, SpiritualGuidanceAdminController],
  providers: [
    SpiritualGuidanceService,
    CitationService,
    EmotionMappingService,
    QualityControlService,
    DocumentSearchService,
    SpiritualGuidanceAdminService,
    TrainingDataService,
    QATrainingService,
    SourceTrackingService,
    FineTunedGuidanceService
  ],
  exports: [
    SpiritualGuidanceService,
    CitationService,
    EmotionMappingService,
    QualityControlService,
    DocumentSearchService,
    SpiritualGuidanceAdminService,
    TrainingDataService,
    QATrainingService,
    SourceTrackingService,
    FineTunedGuidanceService
  ],
})
export class SpiritualGuidanceModule {}