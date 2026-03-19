import { Test, TestingModule } from '@nestjs/testing';
import { MarketService } from './market.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../services/redis.service';
import { DataGateway } from '../../services/data-gateway/data-gateway.service';
import { RealtimePushService } from './realtime-push.service';

describe('MarketService', () => {
  let service: MarketService;

  const mockPrisma = {
    stock: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
    historyData: { findMany: jest.fn() },
    realtimeData: { findMany: jest.fn(), findUnique: jest.fn() },
    sector: { findMany: jest.fn() },
    sectorHistory: { findMany: jest.fn() },
    sectorStock: { findMany: jest.fn() },
    limitUp: { findFirst: jest.fn() },
    limitUpStock: { findMany: jest.fn(), count: jest.fn() },
  };

  const mockRedis = { get: jest.fn(), set: jest.fn() };
  const mockDataGateway = { getMinuteData: jest.fn(), getHotStocks: jest.fn() };
  const mockRealtimePush = { getSnapshot: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: DataGateway, useValue: mockDataGateway },
        { provide: RealtimePushService, useValue: mockRealtimePush },
      ],
    }).compile();

    service = module.get<MarketService>(MarketService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getStockList', () => {
    it('should return paginated stock list', async () => {
      const mockStocks = [
        { code: '600000', name: '浦发银行', market: 'SH' },
        { code: '000001', name: '平安银行', market: 'SZ' },
      ];

      mockPrisma.stock.findMany.mockResolvedValue(mockStocks);
      mockPrisma.stock.count.mockResolvedValue(2);

      const result = await service.getStockList({ page: 1, pageSize: 20 });

      expect(result.items).toEqual(mockStocks);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(mockPrisma.stock.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { code: 'asc' },
        include: { realtime: true },
      });
      expect(mockPrisma.stock.count).toHaveBeenCalledWith({ where: {} });
    });

    it('should filter by keyword', async () => {
      const mockStocks = [{ code: '600000', name: '浦发银行', market: 'SH' }];

      mockPrisma.stock.findMany.mockResolvedValue(mockStocks);
      mockPrisma.stock.count.mockResolvedValue(1);

      const result = await service.getStockList({ keyword: '浦发', page: 1, pageSize: 20 });

      expect(result.items).toEqual(mockStocks);
      expect(mockPrisma.stock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { code: { contains: '浦发' } },
              { name: { contains: '浦发' } },
            ]),
          }),
        }),
      );
    });

    it('should filter by market', async () => {
      mockPrisma.stock.findMany.mockResolvedValue([]);
      mockPrisma.stock.count.mockResolvedValue(0);

      await service.getStockList({ market: 'SH', page: 1, pageSize: 20 });

      expect(mockPrisma.stock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ market: 'SH' }),
        }),
      );
    });

    it('should filter by industry', async () => {
      mockPrisma.stock.findMany.mockResolvedValue([]);
      mockPrisma.stock.count.mockResolvedValue(0);

      await service.getStockList({ industry: '银行', page: 1, pageSize: 20 });

      expect(mockPrisma.stock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ industry: '银行' }),
        }),
      );
    });

    it('should combine multiple filters', async () => {
      mockPrisma.stock.findMany.mockResolvedValue([]);
      mockPrisma.stock.count.mockResolvedValue(0);

      await service.getStockList({ market: 'SH', industry: '银行', keyword: '浦发', page: 1, pageSize: 20 });

      expect(mockPrisma.stock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            market: 'SH',
            industry: '银行',
            OR: expect.any(Array),
          }),
        }),
      );
    });

    it('should calculate skip correctly for pagination', async () => {
      mockPrisma.stock.findMany.mockResolvedValue([]);
      mockPrisma.stock.count.mockResolvedValue(0);

      await service.getStockList({ page: 3, pageSize: 10 });

      expect(mockPrisma.stock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });
  });

  describe('getStock', () => {
    it('should return stock by code', async () => {
      const mockStock = { code: '600000', name: '浦发银行', market: 'SH' };
      mockPrisma.stock.findUnique.mockResolvedValue(mockStock);

      const result = await service.getStock('600000');

      expect(result).toEqual(mockStock);
      expect(mockPrisma.stock.findUnique).toHaveBeenCalledWith({
        where: { code: '600000' },
        include: { realtime: true },
      });
    });

    it('should return null if stock not found', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue(null);

      const result = await service.getStock('000000');

      expect(result).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('should return history data for code with default adjust', async () => {
      const mockHistory = [
        { date: new Date('2024-01-01'), open: 10, close: 11, high: 12, low: 9, volume: 1000, adjust: 'None' },
      ];
      mockPrisma.historyData.findMany.mockResolvedValue(mockHistory);

      const result = await service.getHistory({ code: '600000' });

      expect(result).toEqual(mockHistory);
      expect(mockPrisma.historyData.findMany).toHaveBeenCalledWith({
        where: { code: '600000', adjust: 'None', date: {} },
        orderBy: { date: 'asc' },
      });
    });

    it('should filter by adjust type', async () => {
      mockPrisma.historyData.findMany.mockResolvedValue([]);

      await service.getHistory({ code: '600000', adjust: 'Forward' });

      expect(mockPrisma.historyData.findMany).toHaveBeenCalledWith({
        where: { code: '600000', adjust: 'Forward', date: {} },
        orderBy: { date: 'asc' },
      });
    });

    it('should filter by date range', async () => {
      mockPrisma.historyData.findMany.mockResolvedValue([]);

      await service.getHistory({
        code: '600000',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(mockPrisma.historyData.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          code: '600000',
          adjust: 'None',
          date: expect.objectContaining({
            gte: new Date('2024-01-01'),
            lte: new Date('2024-12-31'),
          }),
        }),
        orderBy: { date: 'asc' },
      });
    });

    it('should filter by startDate only', async () => {
      mockPrisma.historyData.findMany.mockResolvedValue([]);

      await service.getHistory({
        code: '600000',
        startDate: '2024-01-01',
      });

      expect(mockPrisma.historyData.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          code: '600000',
          adjust: 'None',
          date: expect.objectContaining({
            gte: new Date('2024-01-01'),
          }),
        }),
        orderBy: { date: 'asc' },
      });
    });

    it('should filter by endDate only', async () => {
      mockPrisma.historyData.findMany.mockResolvedValue([]);

      await service.getHistory({
        code: '600000',
        endDate: '2024-12-31',
      });

      expect(mockPrisma.historyData.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          code: '600000',
          adjust: 'None',
          date: expect.objectContaining({
            lte: new Date('2024-12-31'),
          }),
        }),
        orderBy: { date: 'asc' },
      });
    });
  });

  describe('getRealtime', () => {
    it('should return cached data if exists', async () => {
      const cachedData = { code: '600000', price: 10.5 };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await service.getRealtime('600000');
      expect(result).toEqual(cachedData);
    });

    it('should fetch from DB if not cached', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.realtimeData.findUnique.mockResolvedValue({
        code: '600000', name: '浦发银行', price: 10.5, change: 0.1, changePct: 1.0,
        volume: 1000, amount: 10000, high: 10.8, low: 10.2, open: 10.4, prevClose: 10.4,
        updatedAt: new Date(),
      });

      const result = await service.getRealtime('600000');
      expect(result?.code).toBe('600000');
      expect(result?.price).toBe(10.5);
    });

    it('should return null if no data exists', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.realtimeData.findUnique.mockResolvedValue(null);

      const result = await service.getRealtime('000000');

      expect(result).toBeNull();
    });
  });

  describe('getRealtimeBatch', () => {
    it('should return from SSE snapshot first', async () => {
      const snapshot = [{ code: '600000', price: 10.5 }, { code: '000001', price: 12.0 }];
      mockRealtimePush.getSnapshot.mockResolvedValue(snapshot);

      const result = await service.getRealtimeBatch(['600000', '000001']);
      expect(result).toHaveLength(2);
    });

    it('should fallback to DB if snapshot empty', async () => {
      mockRealtimePush.getSnapshot.mockResolvedValue([]);
      mockPrisma.realtimeData.findMany.mockResolvedValue([
        { code: '600000', price: 10.5 },
      ]);

      const result = await service.getRealtimeBatch(['600000']);
      expect(result).toHaveLength(1);
    });
  });

  describe('getRankings', () => {
    it('should return top gaining stocks by default', async () => {
      const mockStocks = [
        { code: '600000', name: '浦发银行', realtime: { changePct: 5.5 } },
        { code: '000001', name: '平安银行', realtime: { changePct: 4.2 } },
      ];
      mockPrisma.stock.findMany.mockResolvedValue(mockStocks);

      const result = await service.getRankings('up', 50);

      expect(result).toEqual(mockStocks);
      expect(mockPrisma.stock.findMany).toHaveBeenCalledWith({
        where: { realtime: { isNot: null } },
        take: 50,
        orderBy: { realtime: { changePct: 'desc' } },
        include: { realtime: true },
      });
    });

    it('should return top losing stocks when type is down', async () => {
      const mockStocks = [
        { code: '600000', name: '浦发银行', realtime: { changePct: -5.5 } },
      ];
      mockPrisma.stock.findMany.mockResolvedValue(mockStocks);

      const result = await service.getRankings('down', 10);

      expect(result).toEqual(mockStocks);
      expect(mockPrisma.stock.findMany).toHaveBeenCalledWith({
        where: { realtime: { isNot: null } },
        take: 10,
        orderBy: { realtime: { changePct: 'asc' } },
        include: { realtime: true },
      });
    });

    it('should respect custom limit', async () => {
      mockPrisma.stock.findMany.mockResolvedValue([]);

      await service.getRankings('up', 5);

      expect(mockPrisma.stock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  describe('getSectors', () => {
    it('should return all sectors', async () => {
      const mockSectors = [{ id: '1', code: 'IND_INDUSTRY', name: '银行', type: 'INDUSTRY' }];
      mockPrisma.sector.findMany.mockResolvedValue(mockSectors);

      const result = await service.getSectors({});
      expect(result).toEqual(mockSectors);
    });

    it('should filter by type', async () => {
      mockPrisma.sector.findMany.mockResolvedValue([]);

      await service.getSectors({ type: 'INDUSTRY' });

      expect(mockPrisma.sector.findMany).toHaveBeenCalledWith({
        where: { type: 'INDUSTRY' },
      });
    });
  });

  describe('getSectorStocks', () => {
    it('should return stocks in sector', async () => {
      const mockSectorStocks = [
        { stock: { code: '600000', name: '浦发银行', realtime: { price: 10.5 } } },
      ];
      mockPrisma.sectorStock.findMany.mockResolvedValue(mockSectorStocks);

      const result = await service.getSectorStocks('sector-1');
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('600000');
    });
  });

  describe('getLimitUp', () => {
    it('should return empty if no limitUp record found', async () => {
      mockPrisma.limitUp.findFirst.mockResolvedValue(null);

      const result = await service.getLimitUp({});
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should return paginated limit up stocks', async () => {
      const mockLimitUp = { id: 'limit-1', date: new Date(), type: 'LIMIT_UP' };
      const mockStocks = [
        { code: '600000', name: '浦发银行', changePct: 10.0, price: 11.0, amount: 1000000 },
      ];

      mockPrisma.limitUp.findFirst.mockResolvedValue(mockLimitUp);
      mockPrisma.limitUpStock.findMany.mockResolvedValue(mockStocks);
      mockPrisma.limitUpStock.count.mockResolvedValue(1);

      const result = await service.getLimitUp({ page: 1, pageSize: 50 });

      expect(result.items).toEqual(mockStocks);
      expect(result.total).toBe(1);
    });
  });

  describe('getMinuteData', () => {
    it('should delegate to dataGateway', async () => {
      const mockData = [{ time: '09:30', price: 10.5 }];
      mockDataGateway.getMinuteData.mockResolvedValue(mockData);

      const result = await service.getMinuteData('600000');
      expect(result).toEqual(mockData);
    });
  });

  describe('getHotStocks', () => {
    it('should delegate to dataGateway', async () => {
      const mockData = [{ rank: 1, code: '600000', name: '浦发银行' }];
      mockDataGateway.getHotStocks.mockResolvedValue(mockData);

      const result = await service.getHotStocks('A股', '', '今日');
      expect(result).toEqual(mockData);
    });
  });
});
