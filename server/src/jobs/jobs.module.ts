import { Module } from '@nestjs/common';
import { StockListUpdateJob } from './stock-list-update.job';
import { HistoryFillJob } from './history-fill.job';
import { WatchlistRealtimeJob } from './watchlist-realtime.job';
import { FullRealtimeJob } from './full-realtime.job';
import { SectorUpdateJob } from './sector-update.job';
import { LimitUpUpdateJob } from './limit-up-update.job';

@Module({
  providers: [
    StockListUpdateJob,
    HistoryFillJob,
    WatchlistRealtimeJob,
    FullRealtimeJob,
    SectorUpdateJob,
    LimitUpUpdateJob,
  ],
})
export class JobsModule {}