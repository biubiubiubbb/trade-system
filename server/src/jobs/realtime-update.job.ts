import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AkshareService } from '../services/akshare.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../services/redis.service';

@Injectable()
export class RealtimeUpdateJob implements OnModuleInit {
  private readonly logger = new Logger(RealtimeUpdateJob.name);
  private stockCodes: string[] = [];
  private readonly batchSize = 100;

  constructor(
    private readonly akshareService: AkshareService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit() {
    await this.loadStockCodes();
  }

  private async loadStockCodes() {
    const stocks = await this.prisma.stock.findMany({ select: { code: true } });
    this.stockCodes = stocks.map((s) => s.code);
    this.logger.log(`Loaded ${this.stockCodes.length} stock codes`);
  }

  @Interval(60000)
  async updateRealtimeData() {
    if (this.stockCodes.length === 0) return;

    this.logger.log('Starting realtime data update...');

    for (let i = 0; i < this.stockCodes.length; i += this.batchSize) {
      const batch = this.stockCodes.slice(i, i + this.batchSize);

      try {
        const data = await this.akshareService.fetchWithRetry(() =>
          this.akshareService.fetchRealtimeData(batch),
        );

        if (data && data.length > 0) {
          for (const item of data) {
            await this.prisma.realtimeData.upsert({
              where: { code: item.code },
              update: {
                price: item.price, change: item.change, changePct: item.changePct,
                volume: item.volume, amount: item.amount, high: item.high, low: item.low,
                open: item.open, prevClose: item.prevClose, bid1: item.bid1, ask1: item.ask1,
              },
              create: {
                code: item.code, price: item.price,
                change: item.change, changePct: item.changePct, volume: item.volume,
                amount: item.amount, high: item.high, low: item.low, open: item.open,
                prevClose: item.prevClose, bid1: item.bid1, ask1: item.ask1,
              },
            });

            await this.redis.set(`realtime:${item.code}`, JSON.stringify(item), 60);
          }
        }
      } catch (error) {
        this.logger.error(`Failed to update batch ${i / this.batchSize}:`, error);
      }

      await this.sleep(2000);
    }

    this.logger.log('Realtime data update completed');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
