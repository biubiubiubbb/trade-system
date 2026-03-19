import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { AktoolsAdapter } from './data-gateway/adapters/aktools.adapter';
import { DataGateway } from './data-gateway/data-gateway.service';

@Global()
@Module({
  providers: [RedisService, AktoolsAdapter, DataGateway],
  exports: [RedisService, DataGateway],
})
export class ServicesModule {}
