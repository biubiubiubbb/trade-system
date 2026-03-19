import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { RealtimePushService } from './realtime-push.service';
import { DataGateway } from '../../services/data-gateway/data-gateway.service';

@Module({
  controllers: [MarketController],
  providers: [MarketService, RealtimePushService, DataGateway],
  exports: [MarketService],
})
export class MarketModule {}
