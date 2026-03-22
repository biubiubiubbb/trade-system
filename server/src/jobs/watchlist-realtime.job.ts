import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DataGateway } from '../services/data-gateway/data-gateway.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../services/redis.service';
import { RealtimePushService } from '../services/realtime-push.service';

@Injectable()
export class WatchlistRealtimeJob {
  private readonly logger = new Logger(WatchlistRealtimeJob.name);
  private readonly batchSize = 100;

  constructor(
    private readonly dataGateway: DataGateway,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly realtimePush: RealtimePushService,
  ) {}

  @Interval(10000) // every 10 seconds
  async handle() {
    // 1. Get all watchlist stocks from DB
    const watchlists = await this.prisma.watchlist.findMany({
      include: { stocks: true },
    });

    const codes = [...new Set(watchlists.flatMap((w) => w.stocks.map((s) => s.stockCode)))];
    if (codes.length === 0) return;

    this.logger.debug(`Updating ${codes.length} watchlist stocks...`);

    // 2. Fetch, store, and cache in batches
    for (let i = 0; i < codes.length; i += this.batchSize) {
      const batch = codes.slice(i, i + this.batchSize);

      try {
        const realtimeList = await this.dataGateway.getRealtime(batch);

        for (const realtime of realtimeList) {
          // Store to DB
          await this.prisma.realtimeData.upsert({
            where: { code: realtime.code },
            update: {
              price: realtime.price,
              change: realtime.change,
              changePct: realtime.changePct,
              volume: realtime.volume,
              amount: realtime.amount,
              high: realtime.high,
              low: realtime.low,
              open: realtime.open,
              prevClose: realtime.prevClose,
              amplitude: realtime.amplitude,
              turnoverRate: realtime.turnoverRate,
              pe: realtime.pe,
              pb: realtime.pb,
              marketCap: realtime.marketCap,
              floatMarketCap: realtime.floatMarketCap,
              bidAsk: realtime.bidAsk as any,
            },
            create: {
              code: realtime.code,
              name: realtime.name,
              price: realtime.price,
              change: realtime.change,
              changePct: realtime.changePct,
              volume: realtime.volume,
              amount: realtime.amount,
              high: realtime.high,
              low: realtime.low,
              open: realtime.open,
              prevClose: realtime.prevClose,
              amplitude: realtime.amplitude,
              turnoverRate: realtime.turnoverRate,
              pe: realtime.pe,
              pb: realtime.pb,
              marketCap: realtime.marketCap,
              floatMarketCap: realtime.floatMarketCap,
              bidAsk: realtime.bidAsk as any,
            },
          });

          // Cache to Redis
          await this.redis.set(
            `realtime:${realtime.code}`,
            JSON.stringify(realtime),
            120,
          );
        }

        // 3. Push SSE
        this.realtimePush.push(realtimeList);
      } catch (error) {
        this.logger.error(`Batch ${i / this.batchSize} failed:`, error);
      }

      await this.sleep(2000);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}