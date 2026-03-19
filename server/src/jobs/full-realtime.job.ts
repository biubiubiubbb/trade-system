import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DataGateway } from '../services/data-gateway/data-gateway.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../services/redis.service';

@Injectable()
export class FullRealtimeJob {
  private readonly logger = new Logger(FullRealtimeJob.name);
  private readonly batchSize = 100;

  constructor(
    private readonly dataGateway: DataGateway,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Interval(60000) // every minute
  async handle() {
    this.logger.log('Starting full realtime update...');

    const stocks = await this.prisma.stock.findMany({
      select: { code: true },
    });

    for (let i = 0; i < stocks.length; i += this.batchSize) {
      const batch = stocks.slice(i, i + this.batchSize).map((s) => s.code);

      try {
        const realtimeList = await this.dataGateway.getRealtime(batch);

        for (const realtime of realtimeList) {
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
            },
          });

          await this.redis.set(
            `realtime:${realtime.code}`,
            JSON.stringify(realtime),
            120,
          );
        }
      } catch (error) {
        this.logger.error(`Full batch ${i / this.batchSize} failed`);
      }

      await this.sleep(2000);
    }

    this.logger.log('Full realtime update completed');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}