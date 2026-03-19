import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataGateway } from '../services/data-gateway/data-gateway.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SectorUpdateJob {
  private readonly logger = new Logger(SectorUpdateJob.name);

  constructor(
    private readonly dataGateway: DataGateway,
    private readonly prisma: PrismaService,
  ) {}

  // Cron: every 5 minutes, weekdays, trading hours 9:00-15:00
  @Cron('*/5 9-15 * * 1-5')
  async handle() {
    this.logger.log('Starting sector data update...');

    try {
      // Fetch industry board
      const industries = await this.dataGateway.getIndustryBoard();

      for (const industry of industries) {
        // Upsert sector
        const sector = await this.prisma.sector.upsert({
          where: { code: `industry_${industry.name}` },
          update: { name: industry.name, type: 'INDUSTRY' },
          create: {
            code: `industry_${industry.name}`,
            name: industry.name,
            type: 'INDUSTRY',
          },
        });

        // Record today's data
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await this.prisma.sectorHistory.upsert({
          where: {
            sectorId_date: {
              sectorId: sector.id as string,
              date: today,
            },
          },
          update: {
            close: industry.changePct,
            amount: industry.amount,
            volume: industry.volume,
          },
          create: {
            sectorId: sector.id as string,
            date: today,
            open: 0,
            high: 0,
            low: 0,
            close: industry.changePct,
            change: 0,
            changePct: industry.changePct,
            volume: industry.volume,
            amount: industry.amount,
          } as any,
        });
      }

      this.logger.log(`Updated ${industries.length} industry sectors`);
    } catch (error) {
      this.logger.error('Sector update failed:', error);
    }
  }
}