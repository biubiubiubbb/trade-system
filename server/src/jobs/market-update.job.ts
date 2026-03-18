import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AkshareService } from '../services/akshare.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class MarketUpdateJob {
  private readonly logger = new Logger(MarketUpdateJob.name);

  constructor(
    private readonly akshareService: AkshareService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('0 9 * * *')
  async updateStockList() {
    this.logger.log('Starting stock list update...');

    try {
      const stocks = await this.akshareService.fetchStockList();
      this.logger.log(`Fetched ${stocks.length} stocks`);

      for (const stock of stocks) {
        await this.prisma.stock.upsert({
          where: { code: stock.code },
          update: { name: stock.name, market: stock.market },
          create: { code: stock.code, name: stock.name, market: stock.market },
        });
        await this.sleep(50);
      }

      this.logger.log('Stock list update completed');
    } catch (error) {
      this.logger.error('Stock list update failed:', error);
    }
  }

  @Cron('0 16 * * *')
  async fillHistoryData() {
    this.logger.log('Starting history data fill...');

    try {
      const stocks = await this.prisma.stock.findMany({ select: { code: true } });
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 11);

      for (const stock of stocks) {
        const existingData = await this.prisma.historyData.findFirst({
          where: { code: stock.code },
          orderBy: { date: 'desc' },
        });

        const fromDate = existingData
          ? new Date(existingData.date.getTime() + 86400000)
          : startDate;

        if (fromDate >= endDate) continue;

        const data = await this.akshareService.fetchWithRetry(() =>
          this.akshareService.fetchHistoryData(
            stock.code,
            fromDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0],
          ),
        );

        if (data && data.length > 0) {
          await this.prisma.historyData.createMany({
            data: data.map((d) => ({ ...d, date: new Date(d.date) })),
            skipDuplicates: true,
          });
        }

        this.logger.log(`Updated history for ${stock.code}`);
        await this.sleep(500);
      }

      this.logger.log('History data fill completed');
    } catch (error) {
      this.logger.error('History data fill failed:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
