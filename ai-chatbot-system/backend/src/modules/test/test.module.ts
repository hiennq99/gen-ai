import { Module } from '@nestjs/common';
import { TestRedisVectorsController } from './test-redis-vectors.controller';

@Module({
  controllers: [TestRedisVectorsController],
})
export class TestModule {}