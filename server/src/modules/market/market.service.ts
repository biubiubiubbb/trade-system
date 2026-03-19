import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../services/redis.service';
import { DataGateway } from '../../services/data-gateway/data-gateway.service';
import { RealtimePushService } from './realtime-push.service';
import { StockListQueryDto } from './dto/stock.dto';
import { HistoryQueryDto } from './dto/history-query.dto';
import { SectorQueryDto } from './dto/sector.dto';
import { LimitUpQueryDto } from './dto/limit-up.dto';
import { SystemRealtime } from '../../services/data-gateway/types';

@Injectable()
export class MarketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly dataGateway: DataGateway,
    private readonly realtimePush: RealtimePushService,
  ) {}

  // === 股票查询 ===
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
        include: { realtime: true },
      }),
      this.prisma.stock.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getStock(code: string) {
    return this.prisma.stock.findUnique({
      where: { code },
      include: { realtime: true },
    });
  }

  // === 历史行情 ===
  async getHistory(query: HistoryQueryDto) {
    const { code, startDate, endDate, adjust = 'None' } = query;

    const where: any = { code, adjust, date: {} as any };
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);

    return this.prisma.historyData.findMany({
      where,
      orderBy: { date: 'asc' },
    });
  }

  // === 实时行情 ===
  async getRealtime(code: string): Promise<SystemRealtime | null> {
    const cacheKey = `realtime:${code}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const realtime = await this.prisma.realtimeData.findUnique({
      where: { code },
    });

    if (realtime) {
      const result = this.mapPrismaRealtime(realtime);
      await this.redis.set(cacheKey, JSON.stringify(result), 120);
      return result;
    }

    return null;
  }

  async getRealtimeBatch(codes: string[]): Promise<SystemRealtime[]> {
    const snapshot = await this.realtimePush.getSnapshot(codes);
    if (snapshot.length > 0) {
      return snapshot;
    }

    const results = await this.prisma.realtimeData.findMany({
      where: { code: { in: codes } },
    });

    return results.map((r) => this.mapPrismaRealtime(r));
  }

  // === 涨跌幅排行 ===
  async getRankings(type: 'up' | 'down' = 'up', limit: number = 50) {
    return this.prisma.stock.findMany({
      where: { realtime: { isNot: null } },
      take: limit,
      orderBy: { realtime: { changePct: type === 'up' ? 'desc' : 'asc' } },
      include: { realtime: true },
    });
  }

  // === 分钟级数据（按需查询，不存储）===
  async getMinuteData(code: string) {
    return this.dataGateway.getMinuteData(code);
  }

  // === 板块 ===
  async getSectors(query: SectorQueryDto) {
    const where: any = {};
    if (query.type) where.type = query.type;

    return this.prisma.sector.findMany({ where });
  }

  async getSectorHistory(sectorId: string, startDate?: string, endDate?: string) {
    const where: any = { sectorId };
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);

    return this.prisma.sectorHistory.findMany({
      where,
      orderBy: { date: 'asc' },
    });
  }

  async getSectorStocks(sectorId: string) {
    const sectorStocks = await this.prisma.sectorStock.findMany({
      where: { sectorId },
      include: { stock: { include: { realtime: true } } },
    });

    return sectorStocks.map((ss) => ss.stock);
  }

  // === 涨停板 ===
  async getLimitUp(query: LimitUpQueryDto) {
    const date = query.date
      ? new Date(query.date)
      : new Date();
    date.setHours(0, 0, 0, 0);

    const where: any = { date, type: query.type || 'LIMIT_UP' };

    const limitUp = await this.prisma.limitUp.findFirst({ where });
    if (!limitUp) return { items: [], total: 0 };

    const [stocks, total] = await Promise.all([
      this.prisma.limitUpStock.findMany({
        where: { limitUpId: limitUp.id },
        skip: ((query.page || 1) - 1) * (query.pageSize || 50),
        take: query.pageSize || 50,
        orderBy: { changePct: 'desc' },
      }),
      this.prisma.limitUpStock.count({ where: { limitUpId: limitUp.id } }),
    ]);

    return { items: stocks, total, page: query.page || 1, pageSize: query.pageSize || 50 };
  }

  // === 热搜 ===
  async getHotStocks(symbol: string, date: string, time: string) {
    return this.dataGateway.getHotStocks({
      symbol: symbol as any || 'A股',
    });
  }

  // === 辅助方法 ===
  private mapPrismaRealtime(r: any): SystemRealtime {
    return {
      code: r.code,
      name: r.name || '',
      price: r.price,
      change: r.change,
      changePct: r.changePct,
      volume: r.volume,
      amount: r.amount,
      high: r.high,
      low: r.low,
      open: r.open,
      prevClose: r.prevClose,
      amplitude: r.amplitude,
      turnoverRate: r.turnoverRate,
      pe: r.pe,
      pb: r.pb,
      marketCap: r.marketCap,
      floatMarketCap: r.floatMarketCap,
      bidAsk: r.bidAsk,
      updatedAt: r.updatedAt,
    };
  }
}
