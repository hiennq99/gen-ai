import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SearchService } from './search.service';
import { BedrockModule } from '../bedrock/bedrock.module';
import { DatabaseModule } from '../database/database.module';

@Global()
@Module({
  imports: [ConfigModule, BedrockModule, DatabaseModule],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}