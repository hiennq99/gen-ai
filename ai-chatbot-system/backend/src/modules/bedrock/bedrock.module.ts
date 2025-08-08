import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BedrockService } from './bedrock.service';
import { BedrockController } from './bedrock.controller';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [BedrockController],
  providers: [BedrockService],
  exports: [BedrockService],
})
export class BedrockModule {}