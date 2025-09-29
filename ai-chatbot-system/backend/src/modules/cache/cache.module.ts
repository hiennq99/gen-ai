import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheService } from './cache.service';
import { RedisVectorService } from './redis-vector.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [CacheService, RedisVectorService],
  exports: [CacheService, RedisVectorService],
})
export class CacheModule {}