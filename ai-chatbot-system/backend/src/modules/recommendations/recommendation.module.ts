import { Module } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { SearchModule } from '../search/search.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [SearchModule, DatabaseModule],
  providers: [RecommendationService],
  exports: [RecommendationService],
})
export class RecommendationModule {}
