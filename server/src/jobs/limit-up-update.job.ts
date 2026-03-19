import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataGateway } from '../services/data-gateway/data-gateway.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class LimitUpUpdateJob {
  private readonly logger = new Logger(LimitUpUpdateJob.name);

  constructor(
    private readonly dataGateway: DataGateway,
    private readonly prisma: PrismaService,
  ) {}

  // Cron: every 10 minutes, weekdays, trading hours 9:00-15:00
  @Cron('*/10 9-15 * * 1-5')
  async handle() {
    this.logger.log('Starting limit-up data update...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateStr = today.toISOString().split('T')[0];

    try {
      // Update all limit-up types
      await this.updateLimitUpType(dateStr, 'LIMIT_UP');      // limit up
      await this.updateLimitUpType(dateStr, 'LIMIT_DOWN');    // limit down
      await this.updateLimitUpType(dateStr, 'PREV_LIMIT_UP'); // previous limit up
      await this.updateLimitUpType(dateStr, 'STRONG');       // strong stocks

      this.logger.log('Limit-up data update completed');
    } catch (error) {
      this.logger.error('Limit-up update failed:', error);
    }
  }

  private async updateLimitUpType(dateStr: string, type: string) {
    // Call corresponding DataGateway method based on type
    let stocks;
    switch (type) {
      case 'LIMIT_UP':
        stocks = await this.dataGateway.getLimitUpPool(dateStr);
        break;
      case 'LIMIT_DOWN':
        stocks = await this.dataGateway.getLimitDownPool(dateStr);
        break;
      case 'STRONG':
        stocks = await this.dataGateway.getStrongStocks(dateStr);
        break;
      case 'BROKEN':
        stocks = await this.dataGateway.getBrokenStocks(dateStr);
        break;
      default:
        stocks = [];
    }

    if (stocks.length === 0) return;

    // Upsert LimitUp record
    const limitUp = await this.prisma.limitUp.upsert({
      where: { date_type: { date: new Date(dateStr), type } },
      update: {},
      create: { date: new Date(dateStr), type },
    });

    for (const stock of stocks) {
      await this.prisma.limitUpStock.upsert({
        where: {
          limitUpId_code: {
            limitUpId: limitUp.id,
            code: stock.code,
          },
        },
        update: {
          name: stock.name,
          changePct: stock.changePct,
          price: stock.price,
          amount: stock.amount,
          floatMarketCap: stock.floatMarketCap,
          totalMarketCap: stock.totalMarketCap,
          turnoverRate: stock.turnoverRate,
          industry: stock.industry,
        },
        create: {
          limitUpId: limitUp.id,
          code: stock.code,
          name: stock.name,
          changePct: stock.changePct,
          price: stock.price,
          amount: stock.amount,
          floatMarketCap: stock.floatMarketCap,
          totalMarketCap: stock.totalMarketCap,
          turnoverRate: stock.turnoverRate,
          industry: stock.industry,
        },
      });
    }
  }
}