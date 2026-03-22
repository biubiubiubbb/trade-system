import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { AktoolsAdapter } from './data-gateway/adapters/aktools.adapter';
import { DataGateway } from './data-gateway/data-gateway.service';
import { RealtimePushService } from './realtime-push.service';

@Global()
@Module({
  providers: [RedisService, AktoolsAdapter, DataGateway, RealtimePushService],
  exports: [RedisService, DataGateway, RealtimePushService],
})
export class ServicesModule {}