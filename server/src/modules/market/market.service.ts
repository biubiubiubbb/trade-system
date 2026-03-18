import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StockListQueryDto } from './dto/stock.dto';
import { HistoryQueryDto } from './dto/history-query.dto';

@Injectable()
export class MarketService {
  constructor(private readonly prisma: PrismaService) {}

  async getStockList(query: StockListQueryDto) {
    const { keyword, market, industry, page = 1, pageSize = 20 } = query;

    const where: any = {};
    if (market) where.market = market;
    if (industry) where.industry = industry;
    if (keyword) {
      where.OR = [
        { code: { contains: keyword } },
        { name: { contains: keyword } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.stock.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { code: 'asc' },
      }),
      this.prisma.stock.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getStock(code: string) {
    return this.prisma.stock.findUnique({ where: { code } });
  }

  async getHistory(query: HistoryQueryDto) {
    const { code, startDate, endDate, adjust = 'None' } = query;

    const where: any = { code, adjust };
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);

    return this.prisma.historyData.findMany({
      where,
      orderBy: { date: 'asc' },
    });
  }

  async getRealtime(code: string) {
    return this.prisma.realtimeData.findUnique({ where: { code } });
  }

  async getRealtimeBatch(codes: string[]) {
    const results = await Promise.all(
      codes.map((code) => this.getRealtime(code)),
    );
    return results.filter(Boolean);
  }

  async getRankings(limit: number = 50, type: 'up' | 'down' = 'up') {
    return this.prisma.stock.findMany({
      where: { realtime: { isNot: null } },
      take: limit,
      orderBy: { realtime: { changePct: type === 'up' ? 'desc' : 'asc' } },
    });
  }
}
