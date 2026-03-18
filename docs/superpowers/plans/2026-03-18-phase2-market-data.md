# A股交易系统 - 行情数据模块实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现行情数据模块，包括akshare数据采集、历史数据存储、实时行情轮询

**Architecture:**
- NestJS 定时任务调用 akshare 获取数据
- Prisma 存储历史数据到 MySQL
- Redis 缓存实时行情
- 定时任务：每日股票列表更新、历史数据补全、实时行情轮询

**Tech Stack:** NestJS Schedule, axios, Prisma, Redis (ioredis), akshare

---

## 前置条件

- Phase 1 基础设施已完成
- Docker 环境运行中（MySQL + Redis）
- 数据库迁移已执行

---

## 文件结构

```
server/src/
├── modules/
│   └── market/
│       ├── market.module.ts
│       ├── market.controller.ts
│       ├── market.service.ts
│       └── dto/
│           ├── stock.dto.ts
│           └── history-query.dto.ts
├── services/
│   ├── akshare.service.ts
│   └── redis.service.ts
└── jobs/
    ├── market-update.job.ts
    └── realtime-update.job.ts
```

---

## Task 1: 创建 Market 模块基础

**Files:**
- Create: `server/src/modules/market/market.module.ts`
- Create: `server/src/modules/market/market.controller.ts`
- Create: `server/src/modules/market/market.service.ts`
- Create: `server/src/modules/market/dto/stock.dto.ts`
- Create: `server/src/modules/market/dto/history-query.dto.ts`

- [ ] **Step 1: 创建 DTO**

```typescript
// server/src/modules/market/dto/stock.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class StockDto {
  @ApiProperty({ description: '股票代码' })
  code: string;

  @ApiProperty({ description: '股票名称' })
  name: string;

  @ApiProperty({ description: '市场', enum: ['SH', 'SZ'] })
  market: string;

  @ApiProperty({ description: '行业', required: false })
  industry?: string;

  @ApiProperty({ description: '上市日期', required: false })
  listDate?: Date;
}

export class StockListQueryDto {
  @ApiProperty({ description: '搜索关键字', required: false })
  keyword?: string;

  @ApiProperty({ description: '市场', enum: ['SH', 'SZ'], required: false })
  market?: string;

  @ApiProperty({ description: '行业', required: false })
  industry?: string;

  @ApiProperty({ description: '页码', default: 1 })
  page?: number = 1;

  @ApiProperty({ description: '每页数量', default: 20 })
  pageSize?: number = 20;
}

export class StockListResponseDto {
  @ApiProperty({ type: [StockDto] })
  items: StockDto[];

  @ApiProperty({ description: '总数' })
  total: number;

  @ApiProperty({ description: '页码' })
  page: number;

  @ApiProperty({ description: '每页数量' })
  pageSize: number;
}
```

```typescript
// server/src/modules/market/dto/history-query.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class HistoryQueryDto {
  @ApiProperty({ description: '股票代码' })
  @IsString()
  code: string;

  @ApiProperty({ description: '开始日期', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: '结束日期', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: '复权类型', enum: ['None', 'Forward', 'Backward'], default: 'None' })
  @IsOptional()
  adjust?: 'None' | 'Forward' | 'Backward' = 'None';
}
```

- [ ] **Step 2: 创建 MarketService**

```typescript
// server/src/modules/market/market.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../services/redis.service';
import { StockListQueryDto } from './dto/stock.dto';
import { HistoryQueryDto } from './dto/history-query.dto';

@Injectable()
export class MarketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

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
    const cacheKey = `realtime:${code}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const realtime = await this.prisma.realtimeData.findUnique({
      where: { code },
    });

    if (realtime) {
      await this.redis.set(cacheKey, JSON.stringify(realtime), 60);
      return realtime;
    }

    return null;
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
```

- [ ] **Step 3: 创建 MarketController**

```typescript
// server/src/modules/market/market.controller.ts
import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MarketService } from './market.service';
import { StockListQueryDto } from './dto/stock.dto';
import { HistoryQueryDto } from './dto/history-query.dto';

@ApiTags('行情')
@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('stocks')
  @ApiOperation({ summary: '获取股票列表' })
  async getStockList(@Query() query: StockListQueryDto) {
    const result = await this.marketService.getStockList(query);
    return { code: 0, message: 'success', data: result };
  }

  @Get('stocks/:code')
  @ApiOperation({ summary: '获取股票详情' })
  async getStock(@Param('code') code: string) {
    const stock = await this.marketService.getStock(code);
    if (!stock) {
      throw new NotFoundException({ code: 1002, message: 'Stock not found', data: null });
    }
    return { code: 0, message: 'success', data: stock };
  }

  @Get('history/:code')
  @ApiOperation({ summary: '获取历史行情' })
  async getHistory(@Param('code') code: string, @Query() query: Omit<HistoryQueryDto, 'code'>) {
    const data = await this.marketService.getHistory({ code, ...query });
    return { code: 0, message: 'success', data };
  }

  @Get('realtime/:code')
  @ApiOperation({ summary: '获取实时行情' })
  async getRealtime(@Param('code') code: string) {
    const data = await this.marketService.getRealtime(code);
    if (!data) {
      throw new NotFoundException({ code: 1002, message: 'Realtime data not found', data: null });
    }
    return { code: 0, message: 'success', data };
  }

  @Get('realtime/batch')
  @ApiOperation({ summary: '批量获取实时行情' })
  async getRealtimeBatch(@Query('codes') codes: string) {
    const codeList = codes.split(',');
    const data = await this.marketService.getRealtimeBatch(codeList);
    return { code: 0, message: 'success', data };
  }

  @Get('rankings')
  @ApiOperation({ summary: '获取涨跌幅排行' })
  async getRankings(
    @Query('limit') limit: number = 50,
    @Query('type') type: 'up' | 'down' = 'up',
  ) {
    const data = await this.marketService.getRankings(limit, type);
    return { code: 0, message: 'success', data };
  }
}
```

- [ ] **Step 4: 创建 MarketModule**

```typescript
// server/src/modules/market/market.module.ts
import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';

@Module({
  controllers: [MarketController],
  providers: [MarketService],
  exports: [MarketService],
})
export class MarketModule {}
```

- [ ] **Step 5: 更新 AppModule**

```typescript
// server/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { ServicesModule } from './services/services.module';
import { MarketModule } from './modules/market/market.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    ServicesModule,
    MarketModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 6: 测试接口**

```bash
cd server && pnpm start:dev
curl http://localhost:3000/api/v1/market/stocks
```

- [ ] **Step 7: 提交**

```bash
git add server/src/modules/market/ server/src/app.module.ts
git commit -m "feat(market): 创建行情模块基础结构"
```

---

## Task 2: 创建 Redis 服务

**Files:**
- Create: `server/src/services/redis.service.ts`
- Modify: `server/src/services/services.module.ts`

- [ ] **Step 1: 创建 RedisService**

```typescript
// server/src/services/redis.service.ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);

    this.client = new Redis({
      host,
      port,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 100, 3000)),
    });

    this.client.on('error', (err) => console.error('Redis Error:', err));
    this.client.on('connect', () => console.log('Redis connected'));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async mget(...keys: string[]): Promise<(string | null)[]> {
    return this.client.mget(...keys);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }
}
```

- [ ] **Step 2: 创建 ServicesModule**

```typescript
// server/src/services/services.module.ts
import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class ServicesModule {}
```

- [ ] **Step 3: 更新 AppModule 添加 ServicesModule**

```typescript
// server/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { ServicesModule } from './services/services.module';
import { MarketModule } from './modules/market/market.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    ServicesModule,
    MarketModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 4: 提交**

```bash
git add server/src/services/
git commit -m "feat: 创建Redis服务"
```

---

## Task 3: 创建 akshare 数据采集服务

**Files:**
- Create: `server/src/services/akshare.service.ts`

- [ ] **Step 1: 创建 AkshareService**

```typescript
// server/src/services/akshare.service.ts
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from './redis.service';

@Injectable()
export class AkshareService {
  private readonly logger = new Logger(AkshareService.name);
  private readonly client: AxiosInstance;
  private readonly delay: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    this.client = axios.create({ timeout: 30000 });
    this.delay = 1000;
  }

  async fetchStockList(): Promise<{ code: string; name: string; market: string }[]> {
    try {
      const response = await axios.get(
        'https://push2.eastmoney.com/api/qt/clist/get',
        {
          params: {
            pn: 1,
            pz: 5000,
            po: 1,
            np: 1,
            fltt: 2,
            invt: 2,
            fid: 'f3',
            fs: 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048',
            fields: 'f12,f14',
          },
        },
      );

      const data = response.data.data;
      if (!data?.diff) return [];

      return Object.values(data.diff).map((item: any) => ({
        code: item.f12,
        name: item.f14,
        market: item.f12.startsWith('6') ? 'SH' : 'SZ',
      }));
    } catch (error) {
      this.logger.error('Failed to fetch stock list', error);
      return [];
    }
  }

  async fetchHistoryData(
    code: string,
    startDate: string,
    endDate: string,
    adjust: 'None' | 'Forward' | 'Backward' = 'None',
  ): Promise<any[]> {
    try {
      const secid = code.startsWith('6') ? `1.${code}` : `0.${code}`;
      const adjustMap: Record<string, number> = { None: 0, Forward: 2, Backward: 1 };

      const response = await this.client.get(
        'https://push2his.eastmoney.com/api/qt/stock/kline/get',
        {
          params: {
            secid,
            fields1: 'f1,f2,f3,f4,f5,f6',
            fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
            klt: 101,
            fqt: adjustMap[adjust],
            beg: startDate.replace(/-/g, ''),
            end: endDate.replace(/-/g, ''),
            lmt: 1000000,
          },
        },
      );

      const data = response.data.data;
      if (!data?.klines) return [];

      return data.klines.map((line: string) => {
        const [date, open, close, high, low, volume, amount, _, _2, turnover] = line.split(',');
        return {
          code,
          date: new Date(date),
          open: parseFloat(open),
          close: parseFloat(close),
          high: parseFloat(high),
          low: parseFloat(low),
          volume: parseFloat(volume),
          amount: parseFloat(amount),
          turnover: turnover ? parseFloat(turnover) : null,
          adjust,
        };
      });
    } catch (error) {
      this.logger.error(`Failed to fetch history for ${code}`, error);
      return [];
    }
  }

  async fetchRealtimeData(codes: string[]): Promise<any[]> {
    try {
      const secids = codes
        .map((code) => (code.startsWith('6') ? `1.${code}` : `0.${code}`))
        .join(',');

      const response = await this.client.get(
        'https://push2.eastmoney.com/api/qt/ulist.np/get',
        {
          params: {
            fltt: 2,
            invt: 2,
            secids,
            fields: 'f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f14,f15,f16,f17,f18',
          },
        },
      );

      const data = response.data.data;
      if (!data?.diff) return [];

      return Object.values(data.diff).map((item: any) => ({
        code: item.f12,
        name: item.f14,
        price: item.f2,
        change: item.f3,
        changePct: item.f4,
        volume: item.f5,
        amount: item.f6,
        high: item.f15,
        low: item.f16,
        open: item.f17,
        prevClose: item.f18,
        bid1: item.f9 || item.f2,
        ask1: item.f10 || item.f2,
      }));
    } catch (error) {
      this.logger.error('Failed to fetch realtime data', error);
      return [];
    }
  }

  async fetchWithRetry<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T | null> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        this.logger.warn(`Fetch attempt ${i + 1} failed:`, error);
        if (i < maxRetries - 1) {
          await this.sleep(Math.pow(2, i) * this.delay);
        }
      }
    }
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add server/src/services/akshare.service.ts
git commit -m "feat(data): 创建akshare数据采集服务"
```

---

## Task 4: 创建定时任务

**Files:**
- Create: `server/src/jobs/market-update.job.ts`
- Create: `server/src/jobs/realtime-update.job.ts`
- Create: `server/src/jobs/jobs.module.ts`

- [ ] **Step 1: 创建股票列表更新任务**

```typescript
// server/src/jobs/market-update.job.ts
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
```

- [ ] **Step 2: 创建实时行情更新任务**

```typescript
// server/src/jobs/realtime-update.job.ts
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
                code: item.code, name: item.name, price: item.price,
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
```

- [ ] **Step 3: 创建 JobsModule**

```typescript
// server/src/jobs/jobs.module.ts
import { Module } from '@nestjs/common';
import { MarketUpdateJob } from './market-update.job';
import { RealtimeUpdateJob } from './realtime-update.job';

@Module({
  providers: [MarketUpdateJob, RealtimeUpdateJob],
})
export class JobsModule {}
```

- [ ] **Step 4: 更新 AppModule**

```typescript
// server/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { ServicesModule } from './services/services.module';
import { MarketModule } from './modules/market/market.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    ServicesModule,
    MarketModule,
    JobsModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 5: 提交**

```bash
git add server/src/jobs/
git commit -m "feat(data): 添加定时任务采集行情数据"
```

---

## Task 5: 更新前端 Mock 和页面

**Files:**
- Modify: `web/src/mocks/handlers/market.ts`
- Modify: `web/src/pages/Market.tsx`
- Create: `web/src/components/charts/KLineChart.tsx`

- [ ] **Step 1: 更新 Market Mock Handler**

```typescript
// web/src/mocks/handlers/market.ts - 增强版本
import { http, HttpResponse } from 'msw';
import { faker } from '@faker-js/faker';
import { mockStocks, mockHistoryData } from '../data/stocks';

const generateRealtime = (code: string, name: string) => ({
  code,
  name,
  price: faker.number.float({ min: 10, max: 100, fractionDigits: 2 }),
  change: faker.number.float({ min: -5, max: 5, fractionDigits: 2 }),
  changePct: faker.number.float({ min: -10, max: 10, fractionDigits: 2 }),
  volume: faker.number.float({ min: 1000000, max: 100000000 }),
  amount: faker.number.float({ min: 10000000, max: 1000000000 }),
  high: faker.number.float({ min: 50, max: 110, fractionDigits: 2 }),
  low: faker.number.float({ min: 5, max: 50, fractionDigits: 2 }),
  open: faker.number.float({ min: 10, max: 100, fractionDigits: 2 }),
  prevClose: faker.number.float({ min: 10, max: 100, fractionDigits: 2 }),
  bid1: faker.number.float({ min: 10, max: 100, fractionDigits: 2 }),
  ask1: faker.number.float({ min: 10, max: 100, fractionDigits: 2 }),
  updatedAt: new Date().toISOString(),
});

export const marketHandlers = [
  http.get('/api/v1/market/stocks', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword');
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');

    let filtered = mockStocks;
    if (keyword) {
      filtered = mockStocks.filter(
        (s) => s.code.includes(keyword) || s.name.includes(keyword),
      );
    }

    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: { items, total: filtered.length, page, pageSize },
    });
  }),

  http.get('/api/v1/market/stocks/:code', ({ params }) => {
    const stock = mockStocks.find((s) => s.code === params.code);
    if (!stock) {
      return HttpResponse.json(
        { code: 1002, message: 'Stock not found', data: null },
        { status: 404 },
      );
    }
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: { ...stock, realtime: generateRealtime(stock.code, stock.name) },
    });
  }),

  http.get('/api/v1/market/history/:code', ({ params }) => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: mockHistoryData(params.code as string),
    });
  }),

  http.get('/api/v1/market/realtime/:code', ({ params }) => {
    const stock = mockStocks.find((s) => s.code === params.code);
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: generateRealtime(params.code as string, stock?.name || 'Unknown'),
    });
  }),

  http.get('/api/v1/market/realtime/batch', ({ request }) => {
    const url = new URL(request.url);
    const codes = url.searchParams.get('codes')?.split(',') || [];
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: codes.map((code) => {
        const stock = mockStocks.find((s) => s.code === code);
        return generateRealtime(code, stock?.name || 'Unknown');
      }),
    });
  }),

  http.get('/api/v1/market/rankings', ({ request }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const type = url.searchParams.get('type') || 'up';

    const stocks = mockStocks.slice(0, limit).map((s) => ({
      ...s,
      realtime: generateRealtime(s.code, s.name),
    }));

    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: type === 'up'
        ? stocks.sort((a, b) => b.realtime.changePct - a.realtime.changePct)
        : stocks.sort((a, b) => a.realtime.changePct - b.realtime.changePct),
    });
  }),
];
```

- [ ] **Step 2: 创建 K 线图组件**

```tsx
// web/src/components/charts/KLineChart.tsx
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface KLineData {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

interface KLineChartProps {
  data: KLineData[];
  height?: number;
}

export function KLineChart({ data, height = 400 }: KLineChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts>();

  useEffect(() => {
    if (!chartRef.current) return;

    chartInstance.current = echarts.init(chartRef.current);

    const option: echarts.EChartsOption = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      grid: [
        { left: '10%', right: '8%', top: '10%', height: '50%' },
        { left: '10%', right: '8%', top: '65%', height: '20%' },
      ],
      xAxis: [
        { type: 'category', data: data.map((d) => d.date), gridIndex: 0, boundaryGap: false },
        { type: 'category', data: data.map((d) => d.date), gridIndex: 1, boundaryGap: false },
      ],
      yAxis: [
        { scale: true, gridIndex: 0 },
        { scale: true, gridIndex: 1 },
      ],
      series: [
        {
          name: 'K线',
          type: 'candlestick',
          data: data.map((d) => [d.open, d.close, d.low, d.high]),
          xAxisIndex: 0,
          yAxisIndex: 0,
          itemStyle: {
            color: '#ef4444',
            color0: '#22c55e',
            borderColor: '#ef4444',
            borderColor0: '#22c55e',
          },
        },
        {
          name: '成交量',
          type: 'bar',
          data: data.map((d) => ({
            value: d.volume,
            itemStyle: {
              color: d.close >= d.open ? '#ef444480' : '#22c55e80',
            },
          })),
          xAxisIndex: 1,
          yAxisIndex: 1,
        },
      ],
    };

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  }, [data]);

  return <div ref={chartRef} style={{ width: '100%', height: `${height}px` }} />;
}
```

- [ ] **Step 3: 更新行情页面**

```tsx
// web/src/pages/Market.tsx
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { KLineChart } from '../components/charts/KLineChart';

interface Stock {
  code: string;
  name: string;
  market: string;
  industry?: string;
  realtime?: {
    price: number;
    change: number;
    changePct: number;
    high: number;
    low: number;
  };
}

interface HistoryData {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

export function Market() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCode = searchParams.get('code');

  const [stocks, setStocks] = useState<Stock[]>([]);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [historyData, setHistoryData] = useState<HistoryData[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStocks = async () => {
      const params = new URLSearchParams();
      if (keyword) params.set('keyword', keyword);
      params.set('pageSize', '100');

      const res = await fetch(`/api/v1/market/stocks?${params}`);
      const json = await res.json();
      setStocks(json.data?.items || []);
    };
    fetchStocks();
  }, [keyword]);

  useEffect(() => {
    if (!selectedCode) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [stockRes, historyRes] = await Promise.all([
          fetch(`/api/v1/market/stocks/${selectedCode}`),
          fetch(`/api/v1/market/history/${selectedCode}`),
        ]);

        const stockJson = await stockRes.json();
        const historyJson = await historyRes.json();

        setSelectedStock(stockJson.data);
        setHistoryData(historyJson.data || []);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedCode]);

  const handleSelectStock = (code: string) => {
    setSearchParams({ code });
  };

  return (
    <div className="flex h-full">
      {/* 左侧股票列表 */}
      <div className="w-80 border-r overflow-hidden flex flex-col">
        <div className="p-4 border-b">
          <input
            type="text"
            placeholder="搜索股票代码或名称..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {stocks.map((stock) => (
            <div
              key={stock.code}
              onClick={() => handleSelectStock(stock.code)}
              className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                selectedCode === stock.code ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex justify-between">
                <span className="font-medium">{stock.name}</span>
                <span className="text-gray-500">{stock.code}</span>
              </div>
              <div className="text-sm text-gray-500">{stock.industry}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧详情 */}
      <div className="flex-1 p-6 overflow-y-auto">
        {selectedStock ? (
          <div>
            <div className="mb-6">
              <h1 className="text-2xl font-bold">{selectedStock.name}</h1>
              <p className="text-gray-500">{selectedStock.code} | {selectedStock.market}</p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-96">
                <span className="text-gray-500">加载中...</span>
              </div>
            ) : (
              <KLineChart data={historyData} height={500} />
            )}

            <div className="mt-6 grid grid-cols-4 gap-4">
              {[
                { label: '最新价', value: selectedStock.realtime?.price?.toFixed(2) },
                { label: '涨跌幅', value: `${selectedStock.realtime?.changePct?.toFixed(2)}%`, up: true },
                { label: '最高', value: selectedStock.realtime?.high?.toFixed(2) },
                { label: '最低', value: selectedStock.realtime?.low?.toFixed(2) },
              ].map((item) => (
                <div key={item.label} className="p-4 bg-white rounded shadow">
                  <div className="text-sm text-gray-500">{item.label}</div>
                  <div className={`text-xl font-bold ${item.up ? (selectedStock.realtime?.changePct >= 0 ? 'text-up' : 'text-down') : ''}`}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            请选择一只股票查看详情
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 提交**

```bash
git add web/src/mocks/handlers/market.ts web/src/pages/Market.tsx web/src/components/charts/KLineChart.tsx
git commit -m "feat(market): 完成行情页面和K线图组件"
```

---

## Task 6: 编写单元测试

**Files:**
- Create: `server/src/modules/market/market.service.spec.ts`

- [ ] **Step 1: 创建后端测试**

```typescript
// server/src/modules/market/market.service.spec.ts
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
        code: '600000',
        price: 10.5,
      });

      const result = await service.getRealtime('600000');

      expect(result).toEqual({ code: '600000', price: 10.5 });
    });
  });
});
```

- [ ] **Step 2: 运行测试**

```bash
cd server && pnpm test
```

- [ ] **Step 3: 提交**

```bash
git add server/src/modules/market/market.service.spec.ts
git commit -m "test(market): 添加行情服务单元测试"
```

---

## 验证检查清单

- [ ] `GET /api/v1/market/stocks` 返回股票列表
- [ ] `GET /api/v1/market/stocks/:code` 返回股票详情
- [ ] `GET /api/v1/market/history/:code` 返回历史K线数据
- [ ] `GET /api/v1/market/realtime/:code` 返回实时行情
- [ ] `GET /api/v1/market/rankings` 返回涨跌幅排行
- [ ] 定时任务正确配置
- [ ] 前端行情页面正常显示
- [ ] K线图组件正常渲染
- [ ] 单元测试通过
- [ ] 所有代码已提交
