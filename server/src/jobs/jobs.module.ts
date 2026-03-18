import { Module } from '@nestjs/common';
import { MarketUpdateJob } from './market-update.job';
import { RealtimeUpdateJob } from './realtime-update.job';

@Module({
  providers: [MarketUpdateJob, RealtimeUpdateJob],
})
export class JobsModule {}
