import { Test, TestingModule } from '@nestjs/testing';
import { MarketService } from './market.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../services/redis.service';

describe('MarketService', () => {
  let service: MarketService;

  const mockPrisma = {
    stock: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    historyData: {
      findMany: jest.fn(),
    },
    realtimeData: {
      findUnique: jest.fn(),
    },
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
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
      expect(mockPrisma.stock.findUnique).toHaveBeenCalledWith({ where: { code: '600000' } });
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
      expect(mockPrisma.realtimeData.findUnique).not.toHaveBeenCalled();
    });

    it('should fetch from DB if not cached', async () => {
      mockRedis.get.mockResolvedValue(null);
      const dbData = { code: '600000', price: 10.5 };
      mockPrisma.realtimeData.findUnique.mockResolvedValue(dbData);

      const result = await service.getRealtime('600000');

      expect(result).toEqual(dbData);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'realtime:600000',
        JSON.stringify(dbData),
        60,
      );
    });

    it('should return null if no data exists', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.realtimeData.findUnique.mockResolvedValue(null);

      const result = await service.getRealtime('000000');

      expect(result).toBeNull();
    });
  });

  describe('getRealtimeBatch', () => {
    it('should return realtime data for multiple codes', async () => {
      const cached1 = { code: '600000', price: 10.5 };
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(cached1))
        .mockResolvedValueOnce(null);

      const dbData = { code: '000001', price: 12.0 };
      mockPrisma.realtimeData.findUnique.mockResolvedValue(dbData);

      const result = await service.getRealtimeBatch(['600000', '000001']);

      expect(result).toEqual([cached1, dbData]);
    });

    it('should filter out null results', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.realtimeData.findUnique.mockResolvedValue(null);

      const result = await service.getRealtimeBatch(['000000']);

      expect(result).toEqual([]);
    });
  });

  describe('getRankings', () => {
    it('should return top gaining stocks by default', async () => {
      const mockStocks = [
        { code: '600000', name: '浦发银行', realtime: { changePct: 5.5 } },
        { code: '000001', name: '平安银行', realtime: { changePct: 4.2 } },
      ];
      mockPrisma.stock.findMany.mockResolvedValue(mockStocks);

      const result = await service.getRankings(50, 'up');

      expect(result).toEqual(mockStocks);
      expect(mockPrisma.stock.findMany).toHaveBeenCalledWith({
        where: { realtime: { isNot: null } },
        take: 50,
        orderBy: { realtime: { changePct: 'desc' } },
      });
    });

    it('should return top losing stocks when type is down', async () => {
      const mockStocks = [
        { code: '600000', name: '浦发银行', realtime: { changePct: -5.5 } },
      ];
      mockPrisma.stock.findMany.mockResolvedValue(mockStocks);

      const result = await service.getRankings(10, 'down');

      expect(result).toEqual(mockStocks);
      expect(mockPrisma.stock.findMany).toHaveBeenCalledWith({
        where: { realtime: { isNot: null } },
        take: 10,
        orderBy: { realtime: { changePct: 'asc' } },
      });
    });

    it('should respect custom limit', async () => {
      mockPrisma.stock.findMany.mockResolvedValue([]);

      await service.getRankings(5, 'up');

      expect(mockPrisma.stock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });
});
