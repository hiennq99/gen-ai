import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BedrockService } from './bedrock.service';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [],
  providers: [BedrockService],
  exports: [BedrockService],
})
export class BedrockModule {}