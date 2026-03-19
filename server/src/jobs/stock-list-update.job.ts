import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataGateway } from '../services/data-gateway/data-gateway.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class StockListUpdateJob {
  private readonly logger = new Logger(StockListUpdateJob.name);

  constructor(
    private readonly dataGateway: DataGateway,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('0 9 * * 1-5')
  async handle() {
    this.logger.log('Starting stock list update...');
    try {
      const stocks = await this.dataGateway.getStockList();
      this.logger.log(`Fetched ${stocks.length} stocks`);

      for (const stock of stocks) {
        await this.prisma.stock.upsert({
          where: { code: stock.code },
          update: { name: stock.name, market: stock.market },
          create: {
            code: stock.code,
            name: stock.name,
            market: stock.market,
          },
        });
        await this.sleep(50);
      }

      this.logger.log('Stock list update completed');
    } catch (error) {
      this.logger.error('Stock list update failed:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}