import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataGateway } from '../services/data-gateway/data-gateway.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class HistoryFillJob {
  private readonly logger = new Logger(HistoryFillJob.name);

  constructor(
    private readonly dataGateway: DataGateway,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('0 16 * * 1-5')
  async handle() {
    this.logger.log('Starting history data fill...');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 11);

    const stocks = await this.prisma.stock.findMany({
      select: { code: true },
    });

    for (const stock of stocks) {
      try {
        // Check existing data for each adjust type
        const existingData = await this.prisma.historyData.findFirst({
          where: { code: stock.code },
          orderBy: { date: 'desc' },
        });

        const fromDate = existingData
          ? new Date(existingData.date.getTime() + 86400000)
          : startDate;

        if (fromDate >= endDate) continue;

        // Fetch all three adjust types
        for (const adjust of ['None', 'Forward', 'Backward'] as const) {
          const data = await this.dataGateway.getHistory({
            code: stock.code,
            startDate: fromDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            adjust,
          });

          if (data.length > 0) {
            await this.prisma.historyData.createMany({
              data: data.map((d) => ({
                code: d.code,
                date: d.date,
                open: d.open,
                close: d.close,
                high: d.high,
                low: d.low,
                volume: d.volume,
                amount: d.amount,
                turnover: d.turnover ?? 0,
                adjust,
              })),
              skipDuplicates: true,
            });
          }
        }

        this.logger.log(`Updated history for ${stock.code}`);
      } catch (error) {
        this.logger.error(`Failed to update ${stock.code}:`, error);
      }

      await this.sleep(500);
    }

    this.logger.log('History data fill completed');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}