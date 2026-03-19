# 行情模块重构 - 后端实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构后端行情数据层，完成数据采集、存储、推送的完整链路。

**Architecture:**
- 数据源网关（DataGateway）作为统一入口，内部按类型路由到对应 Adapter，支持主备数据源降级
- 定时任务分两类：自选股高频轮询（10秒）+ 全量低频兜底（1分钟）+ 板块/涨停定时采集
- SSE 推送服务基于 RxJS Subject 实现，支持多订阅者

**Tech Stack:** NestJS, Prisma, MySQL, Redis, RxJS, SSE

---

## 文件结构

```
server/src/
├── services/
│   ├── data-gateway/
│   │   ├── data-gateway.service.ts      # 网关主服务（统一入口）
│   │   ├── adapters/
│   │   │   ├── base.adapter.ts          # 基类，定义统一接口
│   │   │   ├── eastmoney.adapter.ts     # 东财 adapter（主）
│   │   │   ├── sina.adapter.ts          # 新浪 adapter（降级）
│   │   │   ├── tencent.adapter.ts       # 腾讯 adapter（降级）
│   │   │   ├── ths.adapter.ts           # 同花顺 adapter
│   │   │   └── baidu.adapter.ts         # 百度 adapter
│   │   └── types.ts                     # 统一数据类型定义
│   └── services.module.ts                # 更新
├── modules/market/
│   ├── dto/
│   │   ├── stock.dto.ts                 # 扩展字段
│   │   ├── history-query.dto.ts          # 保留
│   │   ├── sector.dto.ts                 # 新增
│   │   └── limit-up.dto.ts              # 新增
│   ├── market.module.ts                  # 更新
│   ├── market.service.ts                # 重写
│   ├── market.controller.ts             # 扩展
│   ├── realtime-push.service.ts        # 新增（SSE）
│   └── market.service.spec.ts           # 更新
├── jobs/
│   ├── market-update.job.ts             # 重写
│   ├── realtime-update.job.ts           # 重写（删除，合并到新 job）
│   ├── sector-update.job.ts             # 新增
│   ├── limit-up-update.job.ts           # 新增
│   └── jobs.module.ts                   # 更新
└── prisma/
    └── schema.prisma                    # 更新
```

---

## Task 1: 数据库 Schema 重构

**Files:**
- Modify: `server/prisma/schema.prisma`
- Modify: `server/src/modules/market/market.module.ts`（导入 PrismaService）

- [ ] **Step 1: 修改 schema.prisma — Stock 扩展字段**

读取并修改 `server/prisma/schema.prisma`，在 Stock model 中增加 `totalShares`、`floatShares` 字段：

```prisma
// 在 Stock model 的 listDate 字段后添加：
totalShares    Float?    // 总股本
floatShares    Float?    // 流通股本
```

- [ ] **Step 2: 修改 schema.prisma — RealtimeData 增强字段**

在 RealtimeData model 中增加新字段：

```prisma
// 在 updatedAt 字段后添加：
amplitude      Float?    // 振幅 (%)
turnoverRate   Float?    // 换手率 (%)
pe             Float?    // 市盈率（动态）
pb             Float?    // 市净率
marketCap      Float?    // 总市值
floatMarketCap Float?    // 流通市值
bidAsk         Json?     // 五档买卖盘
```

- [ ] **Step 3: 添加 Sector model**

在 schema.prisma 文件末尾添加：

```prisma
model Sector {
  id        String      @id @default(uuid())
  code      String      @unique  // 板块代码
  name      String                // 板块名称
  type      String                // INDUSTRY | CONCEPT
  parentId  String?              // 父板块ID
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  stocks    SectorStock[]
  history   SectorHistory[]
}

model SectorHistory {
  id        Int      @id @default(autoincrement())
  sectorId  String
  date      DateTime
  open      Float
  high      Float
  low       Float
  close     Float
  volume    Float
  amount    Float

  sector    Sector   @relation(fields: [sectorId], references: [id])

  @@unique([sectorId, date])
  @@index([sectorId, date])
}

model SectorStock {
  sectorId   String
  stockCode  String
  addedAt    DateTime @default(now())

  sector     Sector   @relation(fields: [sectorId], references: [id], onDelete: Cascade)
  stock      Stock    @relation(fields: [stockCode], references: [code], onDelete: Cascade)

  @@id([sectorId, stockCode])
}
```

- [ ] **Step 4: 添加 LimitUp / LimitUpStock model**

```prisma
model LimitUp {
  id        String   @id @default(uuid())
  date      DateTime
  type      String   // LIMIT_UP | LIMIT_DOWN | PREV_LIMIT_UP | STRONG | BROKEN
  createdAt DateTime @default(now())

  stocks    LimitUpStock[]

  @@unique([date, type])
  @@index([date])
}

model LimitUpStock {
  id              String   @id @default(uuid())
  limitUpId       String
  stockCode       String
  name            String
  changePct       Float
  price           Float
  amount          Float    // 成交额
  floatMarketCap  Float?   // 流通市值
  totalMarketCap  Float?   // 总市值
  turnoverRate    Float?   // 换手率
  sealAmount      Float?   // 封板资金
  firstSealTime   String?  // 首次封板时间
  lastSealTime    String?  // 最后封板时间
  brokenCount     Int?     // 炸板次数
  continueBoard   Int?     // 连板数
  industry        String?  // 所属行业
  createdAt       DateTime @default(now())

  limitUp         LimitUp  @relation(fields: [limitUpId], references: [id], onDelete: Cascade)
  stock           Stock    @relation(fields: [stockCode], references: [code], onDelete: Cascade)

  @@index([limitUpId])
  @@index([stockCode])
}
```

- [ ] **Step 5: 更新 MarketModule 导入 PrismaService**

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
// 注：PrismaService 已通过 DatabaseModule 全局注入，无需显式导入
```

- [ ] **Step 6: 生成 Prisma 迁移**

Run: `cd server && pnpm prisma migrate dev --name add-sector-limitup`
Expected: 迁移成功，创建新表

- [ ] **Step 7: 提交**

```bash
git add server/prisma/schema.prisma
git commit -m "feat(market): 重构数据库Schema，新增Sector/LimitUp表及扩展字段"
```

---

## Task 2: 数据源网关（DataGateway）

**Files:**
- Create: `server/src/services/data-gateway/types.ts`
- Create: `server/src/services/data-gateway/adapters/base.adapter.ts`
- Create: `server/src/services/data-gateway/adapters/eastmoney.adapter.ts`
- Create: `server/src/services/data-gateway/adapters/sina.adapter.ts`
- Create: `server/src/services/data-gateway/adapters/tencent.adapter.ts`
- Create: `server/src/services/data-gateway/adapters/ths.adapter.ts`
- Create: `server/src/services/data-gateway/adapters/baidu.adapter.ts`
- Create: `server/src/services/data-gateway/data-gateway.service.ts`
- Modify: `server/src/services/services.module.ts`
- Delete: `server/src/services/akshare.service.ts`

- [ ] **Step 1: 创建统一类型定义**

```typescript
// server/src/services/data-gateway/types.ts

// === 系统标准数据结构 ===

export interface SystemStock {
  code: string;
  name: string;
  market: string; // SH | SZ
  industry?: string;
  totalShares?: number;
  floatShares?: number;
  listDate?: Date;
}

export interface SystemRealtime {
  code: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  amount: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  amplitude?: number;
  turnoverRate?: number;
  pe?: number;
  pb?: number;
  marketCap?: number;
  floatMarketCap?: number;
  bidAsk?: SystemBidAsk;
  updatedAt: Date;
}

export interface SystemBidAsk {
  bid1: { price: number; vol: number };
  bid2: { price: number; vol: number };
  bid3: { price: number; vol: number };
  bid4: { price: number; vol: number };
  bid5: { price: number; vol: number };
  ask1: { price: number; vol: number };
  ask2: { price: number; vol: number };
  ask3: { price: number; vol: number };
  ask4: { price: number; vol: number };
  ask5: { price: number; vol: number };
}

export interface SystemHistory {
  code: string;
  date: Date;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  turnover?: number;
  adjust: 'None' | 'Forward' | 'Backward';
}

export interface SystemMinute {
  time: string;
  price: number;
  volume: number;
  amount: number;
}

export interface SystemIndustryBoard {
  name: string;
  changePct: number;
  volume: number;
  amount: number;
  netInflow: number;
  riseCount: number;
  fallCount: number;
  leaderStock: string;
  leaderStockPrice: number;
  leaderStockChangePct: number;
}

export interface SystemConceptBoard {
  name: string;
  changePct: number;
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
}

export interface SystemLimitUpStock {
  code: string;
  name: string;
  changePct: number;
  price: number;
  amount: number;
  floatMarketCap?: number;
  totalMarketCap?: number;
  turnoverRate?: number;
  sealAmount?: number;
  firstSealTime?: string;
  lastSealTime?: string;
  brokenCount?: number;
  continueBoard?: number;
  industry?: string;
}

export interface SystemHotStock {
  name: string;
  code: string;
  changePct: string;
  heat: number;
}

// === 数据类型枚举 ===
export enum DataType {
  REALTIME = 'REALTIME',
  BID_ASK = 'BID_ASK',
  HISTORY = 'HISTORY',
  MINUTE = 'MINUTE',
  INDUSTRY_BOARD = 'INDUSTRY_BOARD',
  CONCEPT_BOARD = 'CONCEPT_BOARD',
  LIMIT_UP = 'LIMIT_UP',
  HOT = 'HOT',
  STOCK_LIST = 'STOCK_LIST',
}

// === 请求参数类型 ===
export interface HistoryParams {
  code: string;
  startDate: string;
  endDate: string;
  adjust?: 'None' | 'Forward' | 'Backward';
}

export interface MinuteParams {
  code: string;
  period: '1' | '5' | '15' | '30' | '60';
  date?: string;
}

export interface HotParams {
  symbol: 'A股' | '全部';
  date: string;
  time: '今日' | '1小时';
}
```

- [ ] **Step 2: 创建 BaseAdapter 基类**

```typescript
// server/src/services/data-gateway/adapters/base.adapter.ts
import { Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export abstract class BaseAdapter {
  protected readonly logger = new Logger(this.constructor.name);
  protected readonly client: AxiosInstance;
  protected readonly delay: number;

  constructor(baseURL?: string) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
    });
    this.delay = 500; // 默认请求间隔 500ms
  }

  protected async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected async fetchWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
  ): Promise<T | null> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        this.logger.warn(`Attempt ${i + 1} failed:`, error);
        if (i < maxRetries - 1) {
          await this.sleep(Math.pow(2, i) * this.delay);
        }
      }
    }
    return null;
  }

  abstract getType(): string;
  abstract isAvailable(): boolean;
}
```

- [ ] **Step 3: 创建 EastMoneyAdapter（东财）**

```typescript
// server/src/services/data-gateway/adapters/eastmoney.adapter.ts
import { Injectable } from '@nestjs/common';
import { BaseAdapter } from './base.adapter';
import {
  SystemStock,
  SystemRealtime,
  SystemHistory,
  SystemBidAsk,
  SystemLimitUpStock,
  HistoryParams,
} from '../types';

@Injectable()
export class EastMoneyAdapter extends BaseAdapter {
  getType(): string {
    return 'eastmoney';
  }

  isAvailable(): boolean {
    return true;
  }

  // 股票列表（东财全市场）
  async fetchStockList(): Promise<SystemStock[]> {
    const response = await this.client.get(
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
  }

  // 实时行情（批量）
  async fetchRealtime(codes: string[]): Promise<SystemRealtime[]> {
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
          fields:
            'f2,f3,f4,f5,f6,f8,f9,f10,f12,f14,f15,f16,f17,f18,f20,f37,f38',
        },
      },
    );

    const data = response.data.data;
    if (!data?.diff) return [];

    return Object.values(data.diff).map((item: any) => ({
      code: item.f12,
      name: item.f14,
      price: item.f2 ?? 0,
      change: item.f3 ?? 0,
      changePct: item.f4 ?? 0,
      volume: item.f5 ?? 0,
      amount: item.f6 ?? 0,
      amplitude: item.f8 ?? null,
      pe: item.f9 ?? null,
      pb: item.f10 ?? null,
      high: item.f15 ?? 0,
      low: item.f16 ?? 0,
      open: item.f17 ?? 0,
      prevClose: item.f18 ?? 0,
      marketCap: item.f20 ?? null,
      floatMarketCap: item.f37 ?? null,
      turnoverRate: item.f38 ?? null,
      bidAsk: null,
      updatedAt: new Date(),
    }));
  }

  // 历史K线
  async fetchHistory(params: HistoryParams): Promise<SystemHistory[]> {
    const secid = params.code.startsWith('6')
      ? `1.${params.code}`
      : `0.${params.code}`;
    const adjustMap: Record<string, number> = {
      None: 0,
      Forward: 2,
      Backward: 1,
    };

    const response = await this.client.get(
      'https://push2his.eastmoney.com/api/qt/stock/kline/get',
      {
        params: {
          secid,
          fields1: 'f1,f2,f3,f4,f5,f6',
          fields2:
            'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
          klt: 101, // 日线
          fqt: adjustMap[params.adjust || 'None'],
          beg: params.startDate.replace(/-/g, ''),
          end: params.endDate.replace(/-/g, ''),
          lmt: 1000000,
        },
      },
    );

    const data = response.data.data;
    if (!data?.klines) return [];

    return data.klines.map((line: string) => {
      const [
        date, open, close, high, low, volume, amount, _, _2, turnover,
      ] = line.split(',');
      return {
        code: params.code,
        date: new Date(date),
        open: parseFloat(open),
        close: parseFloat(close),
        high: parseFloat(high),
        low: parseFloat(low),
        volume: parseFloat(volume),
        amount: parseFloat(amount),
        turnover: turnover ? parseFloat(turnover) : null,
        adjust: params.adjust || 'None',
      };
    });
  }

  // 买卖盘口
  async fetchBidAsk(code: string): Promise<SystemBidAsk | null> {
    const secid = code.startsWith('6') ? `1.${code}` : `0.${code}`;

    const response = await this.client.get(
      'https://push2.eastmoney.com/api/qt/stock/get',
      {
        params: {
          secid,
          fields:
            'f14,f15,f16,f17,f18,bid1,ask1',
        },
      },
    );

    const data = response.data.data;
    if (!data) return null;

    // 东财买卖盘口格式: bid1_vol,bid1,bid2_vol,bid2,...bid5,bid5_vol,ask1_vol,ask1,...
    const raw = data.data;
    if (!raw) return null;

    // 从完整数据中解析五档
    const bidAskStr = raw['47'] || '';
    if (!bidAskStr) return null;

    const parts = bidAskStr.split(',');
    if (parts.length < 20) return null;

    return {
      bid1: { price: parseFloat(parts[1]), vol: parseFloat(parts[0]) },
      bid2: { price: parseFloat(parts[3]), vol: parseFloat(parts[2]) },
      bid3: { price: parseFloat(parts[5]), vol: parseFloat(parts[4]) },
      bid4: { price: parseFloat(parts[7]), vol: parseFloat(parts[6]) },
      bid5: { price: parseFloat(parts[9]), vol: parseFloat(parts[8]) },
      ask1: { price: parseFloat(parts[10]), vol: parseFloat(parts[11]) },
      ask2: { price: parseFloat(parts[12]), vol: parseFloat(parts[13]) },
      ask3: { price: parseFloat(parts[14]), vol: parseFloat(parts[15]) },
      ask4: { price: parseFloat(parts[16]), vol: parseFloat(parts[17]) },
      ask5: { price: parseFloat(parts[18]), vol: parseFloat(parts[19]) },
    };
  }

  // 分钟级数据
  async fetchMinute(
    code: string,
    period: string,
  ): Promise<{ time: string; price: number; volume: number; amount: number }[]> {
    const secid = code.startsWith('6') ? `1.${code}` : `0.${code}`;
    const periodMap: Record<string, string> = {
      '1': '101',
      '5': '102',
      '15': '103',
      '30': '104',
      '60': '105',
    };

    const response = await this.client.get(
      'https://push2his.eastmoney.com/api/qt/stock/kline/get',
      {
        params: {
          secid,
          fields1: 'f1,f2,f3,f4,f5,f6',
          fields2: 'f51,f52,f53,f54,f55,f56,f57,f58',
          klt: periodMap[period] || '101',
          fqt: 0,
          beg: '0',
          end: '20500101',
          lmt: 1000,
        },
      },
    );

    const data = response.data.data;
    if (!data?.klines) return [];

    return data.klines.map((line: string) => {
      const [time, price, open, close, high, low, volume, amount] =
        line.split(',');
      return {
        time,
        price: parseFloat(price),
        volume: parseFloat(volume),
        amount: parseFloat(amount),
      };
    });
  }

  // 涨停股池（使用东财市场列表 API，过滤涨幅 >= 9.9%）
  // 注：东财暂无专用涨停池公开 API，此处通过全市场列表 + 涨幅过滤实现
  async fetchLimitUpPool(
    date: string,
  ): Promise<SystemLimitUpStock[]> {
    const response = await this.client.get(
      'https://push2.eastmoney.com/api/qt/clist/get',
      {
        params: {
          pn: 1,
          pz: 2000,
          po: 1,
          np: 1,
          fltt: 2,
          invt: 2,
          fid: 'f3',
          fs: 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048',
          fields:
            'f2,f3,f4,f5,f6,f12,f14,f15,f16,f17,f18,f20,f37,f62,f115,f128',
        },
      },
    );

    const data = response.data.data;
    if (!data?.diff) return [];

    return Object.values(data.diff)
      .filter((item: any) => {
        // 过滤涨幅 >= 9.9% 的股票（近似涨停）
        return item.f3 >= 9.9;
      })
      .map((item: any) => ({
        code: item.f12,
        name: item.f14,
        changePct: item.f3,
        price: item.f2,
        amount: item.f6,
        floatMarketCap: item.f37,
        totalMarketCap: item.f20,
        turnoverRate: item.f38,
        industry: item.f128,
        sealAmount: null,
        firstSealTime: null,
        lastSealTime: null,
        brokenCount: null,
        continueBoard: null,
      }));
  }

  // 跌停股池
  async fetchLimitDownPool(date: string): Promise<SystemLimitUpStock[]> {
    // 跌停: f3 <= -9.9
    const response = await this.client.get(
      'https://push2.eastmoney.com/api/qt/clist/get',
      {
        params: {
          pn: 1, pz: 1000, po: 1, np: 1, fltt: 2, invt: 2,
          fid: 'f3',
          fs: 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048',
          fields: 'f2,f3,f4,f5,f6,f12,f14,f15,f16,f17,f18,f20,f37,f62,f128',
        },
      },
    );

    const data = response.data.data;
    if (!data?.diff) return [];

    return Object.values(data.diff)
      .filter((item: any) => item.f3 <= -9.9)
      .map((item: any) => this.mapLimitUpStock(item));
  }

  // 强势股池
  async fetchStrongStocks(date: string): Promise<SystemLimitUpStock[]> {
    // 强势股: 近期涨幅大，使用东财强势股接口
    // https://quote.eastmoney.com/ztb/detail#type=qsgc
    // 此接口需要登录，此处返回空数组作为占位
    this.logger.warn('Strong stocks fetch not implemented (requires auth)');
    return [];
  }

  // 炸板股池
  async fetchBrokenStocks(date: string): Promise<SystemLimitUpStock[]> {
    // 炸板: 曾涨停但打开，接口需要登录，此处返回空数组作为占位
    this.logger.warn('Broken stocks fetch not implemented (requires auth)');
    return [];
  }

  private mapLimitUpStock(item: any): SystemLimitUpStock {
    return {
      code: item.f12,
      name: item.f14,
      changePct: item.f3,
      price: item.f2,
      amount: item.f6,
      floatMarketCap: item.f37,
      totalMarketCap: item.f20,
      turnoverRate: item.f38,
      industry: item.f128,
      sealAmount: null,
      firstSealTime: null,
      lastSealTime: null,
      brokenCount: null,
      continueBoard: null,
    };
  }
}
```

- [ ] **Step 4: 创建 SinaAdapter（新浪降级）**

```typescript
// server/src/services/data-gateway/adapters/sina.adapter.ts
import { Injectable } from '@nestjs/common';
import { BaseAdapter } from './base.adapter';
import { SystemRealtime, SystemHistory, SystemMinute, HistoryParams, MinuteParams } from '../types';

@Injectable()
export class SinaAdapter extends BaseAdapter {
  getType(): string {
    return 'sina';
  }

  isAvailable(): boolean {
    return true;
  }

  async fetchRealtime(codes: string[]): Promise<SystemRealtime[]> {
    const symbols = codes
      .map((code) => (code.startsWith('6') ? `sh${code}` : `sz${code}`))
      .join(',');

    const response = await this.client.get(
      `https://hq.sinajs.cn/rn=${Date.now()}`,
      {
        params: { list: symbols },
        headers: { 'Referer': 'https://finance.sina.com.cn' },
      },
    );

    const text = response.data;
    const results: SystemRealtime[] = [];
    const regex = /"([^"]+)"/g;
    let match;

    let i = 0;
    while ((match = regex.exec(text)) !== null) {
      const parts = match[1].split(',');
      if (parts.length < 32) continue;

      results.push({
        code: codes[i],
        name: parts[0],
        price: parseFloat(parts[3]) || 0,
        change: parseFloat((parseFloat(parts[3]) - parseFloat(parts[2])).toFixed(2)),
        changePct: parseFloat(
          (((parseFloat(parts[3]) - parseFloat(parts[2])) / parseFloat(parts[2])) * 100).toFixed(2),
        ),
        open: parseFloat(parts[1]) || 0,
        prevClose: parseFloat(parts[2]) || 0,
        high: parseFloat(parts[4]) || 0,
        low: parseFloat(parts[5]) || 0,
        volume: parseFloat(parts[8]) || 0,
        amount: parseFloat(parts[9]) || 0,
        // Sina 数据源不提供以下字段，设为 undefined
        amplitude: undefined,
        turnoverRate: undefined,
        pe: undefined,
        pb: undefined,
        marketCap: undefined,
        floatMarketCap: undefined,
        bidAsk: null,
        updatedAt: new Date(),
      });
      i++;
    }

    return results;
  }

  async fetchMinute(params: MinuteParams): Promise<SystemMinute[]> {
    const symbol = params.code.startsWith('6')
      ? `sh${params.code}`
      : `sz${params.code}`;
    const periodMap: Record<string, string> = {
      '1': '1',
      '5': '5',
      '15': '15',
      '30': '30',
      '60': '60',
    };

    const response = await this.client.get(
      'https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketDataService.getKLineData',
      {
        params: {
          symbol,
          scale: periodMap[params.period] || '5',
          ma: 'no',
          datalen: '1000',
        },
        headers: { 'Referer': 'https://finance.sina.com.cn' },
      },
    );

    const data = typeof response.data === 'string'
      ? JSON.parse(response.data)
      : response.data;
    if (!Array.isArray(data)) return [];

    return data.map((item: any) => ({
      time: item.day,
      price: parseFloat(item.close),
      volume: parseFloat(item.volume),
      amount: parseFloat(item.amount),
    }));
  }
}
```

- [ ] **Step 5: 创建 TencentAdapter（腾讯降级）**

```typescript
// server/src/services/data-gateway/adapters/tencent.adapter.ts
import { Injectable } from '@nestjs/common';
import { BaseAdapter } from './base.adapter';
import { SystemHistory, HistoryParams } from '../types';

@Injectable()
export class TencentAdapter extends BaseAdapter {
  getType(): string {
    return 'tencent';
  }

  isAvailable(): boolean {
    return true;
  }

  async fetchHistory(params: HistoryParams): Promise<SystemHistory[]> {
    const symbol = params.code.startsWith('6')
      ? `sh${params.code}`
      : `sz${params.code}`;
    const adjustMap: Record<string, string> = {
      None: '',
      Forward: 'qfq',
      Backward: 'hfq',
    };

    const response = await this.client.get(
      'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get',
      {
        params: {
          _var: 'kline_dayqfq',
          param: `${symbol},day,${params.startDate},${params.endDate},1000,${adjustMap[params.adjust || 'None']}`,
        },
      },
    );

    const text = response.data as string;
    const jsonStr = text.replace(/^[^{]+/, '');
    const data = JSON.parse(jsonStr);
    const dayData = data.data?.[symbol]?.day;
    if (!dayData || !Array.isArray(dayData)) return [];

    return dayData.map((item: any) => ({
      code: params.code,
      date: new Date(item[0]),
      open: parseFloat(item[1]),
      close: parseFloat(item[2]),
      high: parseFloat(item[3]),
      low: parseFloat(item[4]),
      volume: parseFloat(item[5]),
      amount: parseFloat(item[6]),
      adjust: params.adjust || 'None',
    }));
  }
}
```

- [ ] **Step 6: 创建 THSAdapter（同花顺）**

> 依赖：需安装 HTML 解析库 `pnpm add cheerio && pnpm add -D @types/cheerio`

```typescript
// server/src/services/data-gateway/adapters/ths.adapter.ts
import { Injectable } from '@nestjs/common';
import { BaseAdapter } from './base.adapter';
import { SystemIndustryBoard, SystemConceptBoard } from '../types';

import * as cheerio from 'cheerio';

@Injectable()
export class THSAdapter extends BaseAdapter {
  getType(): string {
    return 'ths';
  }

  isAvailable(): boolean {
    return true;
  }

  // 行业板块一览
  async fetchIndustryBoard(): Promise<SystemIndustryBoard[]> {
    const response = await this.client.post(
      'https://q.10jqka.com.cn/thshy/index/flush/field/zdf/order/desc/page/1/ajax/1/',
      {},
      {
        headers: {
          'Referer': 'https://q.10jqka.com.cn/thshy/',
          'User-Agent': 'Mozilla/5.0',
        },
      },
    );

    const html = response.data as string;
    // 解析 HTML 表格...
    // 使用 cheerio 或简单正则提取
    return this.parseIndustryBoard(html);
  }

  private parseIndustryBoard(html: string): SystemIndustryBoard[] {
    // 使用 cheerio 解析 HTML 表格
    // 需先安装: pnpm add cheerio && pnpm add -D @types/cheerio
    const results: SystemIndustryBoard[] = [];
    const $ = cheerio.load(html);
    $('table tbody tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 8) return;
      const name = $(cells[0]).text().trim();
      const changePctText = $(cells[1]).text().trim();
      const volumeText = $(cells[2]).text().trim();
      const amountText = $(cells[3]).text().trim();
      const netInflowText = $(cells[4]).text().trim();
      const riseText = $(cells[5]).text().trim();
      const fallText = $(cells[6]).text().trim();
      const leaderName = $(cells[7]).text().trim();
      const leaderPrice = $(cells[8]).text().trim();
      const leaderChangeText = $(cells[9]).text().trim();

      if (!name) return;
      results.push({
        name,
        changePct: parseFloat(changePctText) || 0,
        volume: this.parseAmount(volumeText),
        amount: this.parseAmount(amountText),
        netInflow: this.parseAmount(netInflowText),
        riseCount: parseInt(riseText, 10) || 0,
        fallCount: parseInt(fallText, 10) || 0,
        leaderStock: leaderName,
        leaderStockPrice: parseFloat(leaderPrice) || 0,
        leaderStockChangePct: parseFloat(leaderChangeText) || 0,
      });
    });
    return results;
  }

  private parseAmount(text: string): number {
    // 支持 "亿" "万" 后缀，如 "12.34亿" -> 1234000000
    const match = text.match(/^([\d.]+)([亿万])?$/);
    if (!match) return 0;
    const num = parseFloat(match[1]);
    if (match[2] === '亿') return num * 1e8;
    if (match[2] === '万') return num * 1e4;
    return num;
  }

  // 概念板块指数历史
  async fetchConceptBoardHistory(
    symbol: string,
    startDate: string,
    endDate: string,
  ): Promise<SystemConceptBoard[]> {
    const response = await this.client.get(
      'https://q.10jqka.com.cn/gn/detail/code/301558/',
      {
        params: {
          api_type: 'history',
          start: startDate,
          end: endDate,
        },
      },
    );

    // 解析 HTML 表格返回历史数据
    // 返回格式同 SystemConceptBoard[]
    return [];
  }
}
```

- [ ] **Step 7: 创建 BaiduAdapter（百度热搜）**

```typescript
// server/src/services/data-gateway/adapters/baidu.adapter.ts
import { Injectable } from '@nestjs/common';
import { BaseAdapter } from './base.adapter';
import { SystemHotStock, HotParams } from '../types';

@Injectable()
export class BaiduAdapter extends BaseAdapter {
  getType(): string {
    return 'baidu';
  }

  isAvailable(): boolean {
    return true;
  }

  async fetchHotStocks(params: HotParams): Promise<SystemHotStock[]> {
    const response = await this.client.get(
      'https://gushitong.baidu.com/opendata',
      {
        params: {
          query: params.symbol,
          resource_id: '5',
          queryType: 'hot',
        },
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      },
    );

    const data = response.data;
    // ⚠️ 注意：API 响应路径需实际请求后验证，以下为预估路径
    // 建议先用 curl 或 Postman 抓取 https://gushitong.baidu.com/opendata 的实际响应结构
    const cards = data?.Result?.Result?.cards || [];
    const results: SystemHotStock[] = [];
    for (const card of cards) {
      const items = card?.content?.[0]?.content || [];
      for (const item of items) {
        results.push({
          name: item.word,
          code: item.code,
          changePct: parseFloat(item.change_pct) || 0,
          heat: parseInt(item.heat_score, 10) || 0,
        });
      }
    }
    return results;
  }
}
```

- [ ] **Step 8: 创建 DataGateway 主服务**

```typescript
// server/src/services/data-gateway/data-gateway.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EastMoneyAdapter } from './adapters/eastmoney.adapter';
import { SinaAdapter } from './adapters/sina.adapter';
import { TencentAdapter } from './adapters/tencent.adapter';
import { THSAdapter } from './adapters/ths.adapter';
import { BaiduAdapter } from './adapters/baidu.adapter';
import {
  SystemStock,
  SystemRealtime,
  SystemHistory,
  SystemBidAsk,
  SystemMinute,
  SystemIndustryBoard,
  SystemConceptBoard,
  SystemLimitUpStock,
  SystemHotStock,
  HistoryParams,
  MinuteParams,
  HotParams,
} from './types';

@Injectable()
export class DataGateway {
  private readonly logger = new Logger(DataGateway.name);

  constructor(
    private readonly eastMoney: EastMoneyAdapter,
    private readonly sina: SinaAdapter,
    private readonly tencent: TencentAdapter,
    private readonly ths: THSAdapter,
    private readonly baidu: BaiduAdapter,
  ) {}

  // === 股票列表 ===
  async getStockList(): Promise<SystemStock[]> {
    return this.eastMoney.fetchWithRetry(() => this.eastMoney.fetchStockList()) ?? [];
  }

  // === 实时行情（主东财，降级新浪）===
  async getRealtime(codes: string[]): Promise<SystemRealtime[]> {
    const result = await this.fetchWithFallback(
      () => this.eastMoney.fetchRealtime(codes),
      () => this.sina.fetchRealtime(codes),
    );
    return result ?? [];
  }

  // === 历史K线（主东财，降级腾讯）===
  async getHistory(params: HistoryParams): Promise<SystemHistory[]> {
    const result = await this.fetchWithFallback(
      () => this.eastMoney.fetchHistory(params),
      () => this.tencent.fetchHistory(params),
    );
    return result ?? [];
  }

  // === 买卖盘口（东财）===
  async getBidAsk(code: string): Promise<SystemBidAsk | null> {
    return this.eastMoney.fetchWithRetry(() => this.eastMoney.fetchBidAsk(code)) ?? null;
  }

  // === 分钟级数据（主东财，降级新浪，按需不存储）===
  async getMinuteData(params: MinuteParams): Promise<SystemMinute[]> {
    const result = await this.fetchWithFallback(
      () => this.eastMoney.fetchMinute(params.code, params.period),
      () => this.sina.fetchMinute(params),
    );
    return result ?? [];
  }

  // === 行业板块（同花顺）===
  async getIndustryBoard(): Promise<SystemIndustryBoard[]> {
    return this.ths.fetchWithRetry(() => this.ths.fetchIndustryBoard()) ?? [];
  }

  // === 概念板块历史（同花顺）===
  async getConceptBoardHistory(
    symbol: string,
    startDate: string,
    endDate: string,
  ): Promise<SystemConceptBoard[]> {
    return this.ths.fetchWithRetry(() =>
      this.ths.fetchConceptBoardHistory(symbol, startDate, endDate),
    ) ?? [];
  }

  // === 涨停板（东财）===
  async getLimitUpPool(date: string): Promise<SystemLimitUpStock[]> {
    return this.eastMoney.fetchWithRetry(() =>
      this.eastMoney.fetchLimitUpPool(date),
    ) ?? [];
  }

  async getLimitDownPool(date: string): Promise<SystemLimitUpStock[]> {
    return this.eastMoney.fetchWithRetry(() =>
      this.eastMoney.fetchLimitDownPool(date),
    ) ?? [];
  }

  async getStrongStocks(date: string): Promise<SystemLimitUpStock[]> {
    return this.eastMoney.fetchWithRetry(() =>
      this.eastMoney.fetchStrongStocks(date),
    ) ?? [];
  }

  async getBrokenStocks(date: string): Promise<SystemLimitUpStock[]> {
    return this.eastMoney.fetchWithRetry(() =>
      this.eastMoney.fetchBrokenStocks(date),
    ) ?? [];
  }

  // === 热搜（百度）===
  async getHotStocks(params: HotParams): Promise<SystemHotStock[]> {
    return this.baidu.fetchWithRetry(() => this.baidu.fetchHotStocks(params)) ?? [];
  }

  // === 通用降级机制 ===
  private async fetchWithFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    maxRetries = 2,
  ): Promise<T | null> {
    // 尝试主数据源
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await primary();
        if (result !== null && result !== undefined) {
          return result;
        }
      } catch (error) {
        this.logger.warn(`Primary source failed (attempt ${i + 1}):`, error);
        await this.sleep(Math.pow(2, i) * 500);
      }
    }

    // 降级到备用数据源
    this.logger.warn('Falling back to secondary source');
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await fallback();
        if (result !== null && result !== undefined) {
          return result;
        }
      } catch (error) {
        this.logger.warn(`Fallback source failed (attempt ${i + 1}):`, error);
        await this.sleep(Math.pow(2, i) * 500);
      }
    }

    this.logger.error('Both primary and fallback sources failed');
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

- [ ] **Step 9: 更新 ServicesModule**

```typescript
// server/src/services/services.module.ts
import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { DataGateway } from './data-gateway/data-gateway.service';
import { EastMoneyAdapter } from './data-gateway/adapters/eastmoney.adapter';
import { SinaAdapter } from './data-gateway/adapters/sina.adapter';
import { TencentAdapter } from './data-gateway/adapters/tencent.adapter';
import { THSAdapter } from './data-gateway/adapters/ths.adapter';
import { BaiduAdapter } from './data-gateway/adapters/baidu.adapter';

@Global()
@Module({
  providers: [
    RedisService,
    // Adapters
    EastMoneyAdapter,
    SinaAdapter,
    TencentAdapter,
    THSAdapter,
    BaiduAdapter,
    // Gateway
    DataGateway,
  ],
  exports: [RedisService, DataGateway],
})
export class ServicesModule {}
```

- [ ] **Step 10: 删除旧的 akshare.service.ts**

Run: `rm server/src/services/akshare.service.ts`

- [ ] **Step 11: 提交**

```bash
git add server/src/services/
git commit -m "feat(market): 重构为DataGateway数据源网关架构"
```

---

## Task 3: 定时任务重构

**Files:**
- Create: `server/src/jobs/stock-list-update.job.ts`
- Create: `server/src/jobs/history-fill.job.ts`
- Create: `server/src/jobs/watchlist-realtime.job.ts`
- Create: `server/src/jobs/full-realtime.job.ts`
- Create: `server/src/jobs/sector-update.job.ts`
- Create: `server/src/jobs/limit-up-update.job.ts`
- Modify: `server/src/jobs/jobs.module.ts`
- Delete: `server/src/jobs/market-update.job.ts`
- Delete: `server/src/jobs/realtime-update.job.ts`

- [ ] **Step 1: 创建 StockListUpdateJob（每日9:00更新股票列表）**

```typescript
// server/src/jobs/stock-list-update.job.ts
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
```

- [ ] **Step 2: 创建 HistoryFillJob（每日16:00补全历史K线）**

```typescript
// server/src/jobs/history-fill.job.ts
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
        // 检查已有哪些复权类型的数据
        const existingData = await this.prisma.historyData.findFirst({
          where: { code: stock.code },
          orderBy: { date: 'desc' },
        });

        const fromDate = existingData
          ? new Date(existingData.date.getTime() + 86400000)
          : startDate;

        if (fromDate >= endDate) continue;

        // 三种复权类型都拉取
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
```

- [ ] **Step 3: 创建 WatchlistRealtimeJob（自选股10秒高频轮询）**

```typescript
// server/src/jobs/watchlist-realtime.job.ts
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DataGateway } from '../services/data-gateway/data-gateway.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../services/redis.service';
import { RealtimePushService } from '../modules/market/realtime-push.service';

@Injectable()
export class WatchlistRealtimeJob {
  private readonly logger = new Logger(WatchlistRealtimeJob.name);
  private readonly batchSize = 100;

  constructor(
    private readonly dataGateway: DataGateway,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly realtimePush: RealtimePushService,
  ) {}

  @Interval(10000) // 每10秒
  async handle() {
    // 1. 从数据库读取所有自选股代码
    const watchlists = await this.prisma.watchlist.findMany({
      include: { stocks: true },
    });

    const codes = [...new Set(watchlists.flatMap((w) => w.stocks.map((s) => s.stockCode)))];
    if (codes.length === 0) return;

    this.logger.debug(`Updating ${codes.length} watchlist stocks...`);

    // 2. 分批采集 + 存储 + Redis缓存
    for (let i = 0; i < codes.length; i += this.batchSize) {
      const batch = codes.slice(i, i + this.batchSize);

      try {
        const realtimeList = await this.dataGateway.getRealtime(batch);

        for (const realtime of realtimeList) {
          // 存储到数据库
          await this.prisma.realtimeData.upsert({
            where: { code: realtime.code },
            update: {
              price: realtime.price,
              change: realtime.change,
              changePct: realtime.changePct,
              volume: realtime.volume,
              amount: realtime.amount,
              high: realtime.high,
              low: realtime.low,
              open: realtime.open,
              prevClose: realtime.prevClose,
              amplitude: realtime.amplitude,
              turnoverRate: realtime.turnoverRate,
              pe: realtime.pe,
              pb: realtime.pb,
              marketCap: realtime.marketCap,
              floatMarketCap: realtime.floatMarketCap,
              bidAsk: realtime.bidAsk as any,
            },
            create: {
              code: realtime.code,
              name: realtime.name,
              price: realtime.price,
              change: realtime.change,
              changePct: realtime.changePct,
              volume: realtime.volume,
              amount: realtime.amount,
              high: realtime.high,
              low: realtime.low,
              open: realtime.open,
              prevClose: realtime.prevClose,
              amplitude: realtime.amplitude,
              turnoverRate: realtime.turnoverRate,
              pe: realtime.pe,
              pb: realtime.pb,
              marketCap: realtime.marketCap,
              floatMarketCap: realtime.floatMarketCap,
              bidAsk: realtime.bidAsk as any,
            },
          });

          // 缓存到 Redis
          await this.redis.set(
            `realtime:${realtime.code}`,
            JSON.stringify(realtime),
            120,
          );
        }

        // 3. 推送 SSE
        this.realtimePush.push(realtimeList);
      } catch (error) {
        this.logger.error(`Batch ${i / this.batchSize} failed:`, error);
      }

      await this.sleep(2000);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

- [ ] **Step 4: 创建 FullRealtimeJob（全量1分钟轮询兜底）**

```typescript
// server/src/jobs/full-realtime.job.ts
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DataGateway } from '../services/data-gateway/data-gateway.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../services/redis.service';

@Injectable()
export class FullRealtimeJob {
  private readonly logger = new Logger(FullRealtimeJob.name);
  private readonly batchSize = 100;

  constructor(
    private readonly dataGateway: DataGateway,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Interval(60000) // 每分钟
  async handle() {
    this.logger.log('Starting full realtime update...');

    const stocks = await this.prisma.stock.findMany({
      select: { code: true },
    });

    for (let i = 0; i < stocks.length; i += this.batchSize) {
      const batch = stocks.slice(i, i + this.batchSize).map((s) => s.code);

      try {
        const realtimeList = await this.dataGateway.getRealtime(batch);

        for (const realtime of realtimeList) {
          await this.prisma.realtimeData.upsert({
            where: { code: realtime.code },
            update: {
              price: realtime.price,
              change: realtime.change,
              changePct: realtime.changePct,
              volume: realtime.volume,
              amount: realtime.amount,
              high: realtime.high,
              low: realtime.low,
              open: realtime.open,
              prevClose: realtime.prevClose,
              amplitude: realtime.amplitude,
              turnoverRate: realtime.turnoverRate,
              pe: realtime.pe,
              pb: realtime.pb,
              marketCap: realtime.marketCap,
              floatMarketCap: realtime.floatMarketCap,
            },
            create: {
              code: realtime.code,
              name: realtime.name,
              price: realtime.price,
              change: realtime.change,
              changePct: realtime.changePct,
              volume: realtime.volume,
              amount: realtime.amount,
              high: realtime.high,
              low: realtime.low,
              open: realtime.open,
              prevClose: realtime.prevClose,
              amplitude: realtime.amplitude,
              turnoverRate: realtime.turnoverRate,
              pe: realtime.pe,
              pb: realtime.pb,
              marketCap: realtime.marketCap,
              floatMarketCap: realtime.floatMarketCap,
            },
          });

          await this.redis.set(
            `realtime:${realtime.code}`,
            JSON.stringify(realtime),
            120,
          );
        }
      } catch (error) {
        this.logger.error(`Full batch ${i / this.batchSize} failed`);
      }

      await this.sleep(2000);
    }

    this.logger.log('Full realtime update completed');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

- [ ] **Step 5: 创建 SectorUpdateJob（板块数据每5分钟采集）**

```typescript
// server/src/jobs/sector-update.job.ts
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

  // Cron: 每5分钟执行一次，工作日（周一到周五）
  @Cron('*/5 * * * 1-5')
  async handle() {
    this.logger.log('Starting sector data update...');

    try {
      // 采集行业板块
      const industries = await this.dataGateway.getIndustryBoard();

      for (const industry of industries) {
        // upsert 板块
        const sector = await this.prisma.sector.upsert({
          where: { code: `industry_${industry.name}` },
          update: { name: industry.name, type: 'INDUSTRY' },
          create: {
            code: `industry_${industry.name}`,
            name: industry.name,
            type: 'INDUSTRY',
          },
        });

        // 记录当日数据
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await this.prisma.sectorHistory.upsert({
          where: {
            sectorId_date: {
              sectorId: sector.id,
              date: today,
            },
          },
          update: {
            close: industry.changePct, // 简化：行业涨跌幅作为收盘价记录
            amount: industry.amount,
            volume: industry.volume,
          },
          create: {
            sectorId: sector.id,
            date: today,
            open: 0,
            high: 0,
            low: 0,
            close: industry.changePct,
            volume: industry.volume,
            amount: industry.amount,
          },
        });
      }

      this.logger.log(`Updated ${industries.length} industry sectors`);
    } catch (error) {
      this.logger.error('Sector update failed:', error);
    }
  }
}
```

- [ ] **Step 6: 创建 LimitUpUpdateJob（涨停板数据每10分钟采集）**

```typescript
// server/src/jobs/limit-up-update.job.ts
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

  // Cron: 每10分钟执行一次，工作日（周一到周五），限制在交易时段 9:00-15:00
  @Cron('*/10 9-15 * * 1-5')
  async handle() {
    this.logger.log('Starting limit-up data update...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateStr = today.toISOString().split('T')[0];

    try {
      // 更新所有涨停板类型
      await this.updateLimitUpType(dateStr, 'LIMIT_UP');      // 涨停
      await this.updateLimitUpType(dateStr, 'LIMIT_DOWN');     // 跌停
      await this.updateLimitUpType(dateStr, 'PREV_LIMIT_UP');  // 昨日涨停
      await this.updateLimitUpType(dateStr, 'STRONG');         // 强势股

      this.logger.log('Limit-up data update completed');
    } catch (error) {
      this.logger.error('Limit-up update failed:', error);
    }
  }

  private async updateLimitUpType(dateStr: string, type: string) {
    // 根据类型调用对应的 DataGateway 方法
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

    // upsert LimitUp 记录
    const limitUp = await this.prisma.limitUp.upsert({
      where: { date_type: { date: new Date(dateStr), type } },
      update: {},
      create: { date: new Date(dateStr), type },
    });

    for (const stock of stocks) {
      await this.prisma.limitUpStock.upsert({
        where: {
          limitUpId_stockCode: {
            limitUpId: limitUp.id,
            stockCode: stock.code,
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
          stockCode: stock.code,
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
```

- [ ] **Step 7: 更新 JobsModule（删除旧 job，添加新 job）**

```typescript
// server/src/jobs/jobs.module.ts
import { Module } from '@nestjs/common';
import { StockListUpdateJob } from './stock-list-update.job';
import { HistoryFillJob } from './history-fill.job';
import { WatchlistRealtimeJob } from './watchlist-realtime.job';
import { FullRealtimeJob } from './full-realtime.job';
import { SectorUpdateJob } from './sector-update.job';
import { LimitUpUpdateJob } from './limit-up-update.job';

@Module({
  providers: [
    StockListUpdateJob,
    HistoryFillJob,
    WatchlistRealtimeJob,
    FullRealtimeJob,
    SectorUpdateJob,
    LimitUpUpdateJob,
  ],
})
export class JobsModule {}
```

> **注意：** 检查 `jobs.module.ts` 是否残留 `MarketUpdateJob` 和 `RealtimeUpdateJob` 的 import 语句，如有需删除。

- [ ] **Step 8: 删除旧的 job 文件**

Run: `rm server/src/jobs/market-update.job.ts server/src/jobs/realtime-update.job.ts`

- [ ] **Step 9: 提交**

```bash
git add server/src/jobs/
git commit -m "feat(market): 重构定时任务，新增高频/低频轮询及板块涨停采集"
```

---

## Task 4: SSE 推送服务

**Files:**
- Create: `server/src/modules/market/realtime-push.service.ts`
- Modify: `server/src/modules/market/market.controller.ts`

- [ ] **Step 1: 创建 RealtimePushService（SSE 推送核心）**

```typescript
// server/src/modules/market/realtime-push.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import { RedisService } from '../../services/redis.service';
import { SystemRealtime } from '../../services/data-gateway/types';

interface RealtimeEvent {
  codes: string[];
  data: SystemRealtime[];
}

@Injectable()
export class RealtimePushService {
  private readonly logger = new Logger(RealtimePushService.name);
  private readonly subject = new Subject<RealtimeEvent>();

  constructor(private readonly redis: RedisService) {}

  // SSE 端点：支持按 codes 过滤
  sse(codes: string[]): Observable<MessageEvent> {
    // 如果没有指定 codes，订阅所有更新
    if (!codes || codes.length === 0) {
      return this.subject.asObservable().pipe(
        map((event) => {
          const message = JSON.stringify(event.data);
          return new MessageEvent('message', { data: message });
        }),
      );
    }

    // 按指定 codes 过滤
    const codeSet = new Set(codes);
    return this.subject.asObservable().pipe(
      map((event) => {
        const filtered = event.data.filter((d) => codeSet.has(d.code));
        const message = JSON.stringify(filtered);
        return new MessageEvent('message', { data: message });
      }),
      // 空数组会序列化为 '[]'，如果只需要非空推送可取消注释：
      // filter((event) => event.data !== '[]'),
    );
  }

  // 推送数据（供 Job 调用）
  push(data: SystemRealtime[]): void {
    if (data.length === 0) return;
    this.subject.next({ codes: data.map((d) => d.code), data });
  }

  // 获取当前快照（从 Redis 批量读取）
  // 注意：Task 6 会扩展 RedisService.mget 为分批版本 mgetBatch
  async getSnapshot(codes: string[]): Promise<SystemRealtime[]> {
    if (codes.length === 0) return [];

    const keys = codes.map((code) => `realtime:${code}`);
    // 使用现有 mget，批量过大时由 Task 6 扩展为分批版本
    const values = await this.redis.mget(...keys);

    return values
      .filter(Boolean)
      .map((v) => JSON.parse(v) as SystemRealtime);
  }
}
```

- [ ] **Step 2: 在 MarketController 中添加 SSE 端点**

```typescript
// 在 server/src/modules/market/market.controller.ts 中添加

// 导入
import { MessageEvent, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RealtimePushService } from './realtime-push.service';

// 在 class 中添加
constructor(
  private readonly marketService: MarketService,
  private readonly realtimePush: RealtimePushService,
) {}

// 添加 SSE 端点（在 rankings 端点后添加）
@Sse('sse/realtime')
@ApiOperation({ summary: 'SSE实时行情推送' })
sse(@Query('codes') codes: string): Observable<MessageEvent> {
  const codeList = codes ? codes.split(',') : [];
  return this.realtimePush.sse(codeList);
}
```

- [ ] **Step 3: 更新 MarketModule（注入 RealtimePushService）**

```typescript
// server/src/modules/market/market.module.ts
import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { RealtimePushService } from './realtime-push.service';

@Module({
  controllers: [MarketController],
  providers: [MarketService, RealtimePushService],
  exports: [MarketService, RealtimePushService],
})
export class MarketModule {}
```

- [ ] **Step 4: 提交**

```bash
git add server/src/modules/market/
git commit -m "feat(market): 新增SSE实时推送服务RealtimePushService"
```

---

## Task 5: MarketService 重构

**Files:**
- Modify: `server/src/modules/market/market.service.ts`
- Create: `server/src/modules/market/dto/sector.dto.ts`
- Create: `server/src/modules/market/dto/limit-up.dto.ts`
- Modify: `server/src/modules/market/market.controller.ts`（扩展端点）

- [ ] **Step 1: 创建 SectorDto**

```typescript
// server/src/modules/market/dto/sector.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class SectorDto {
  @ApiProperty({ description: '板块ID' })
  id: string;

  @ApiProperty({ description: '板块代码' })
  code: string;

  @ApiProperty({ description: '板块名称' })
  name: string;

  @ApiProperty({ description: '板块类型', enum: ['INDUSTRY', 'CONCEPT'] })
  type: string;
}

export class SectorQueryDto {
  @ApiProperty({ description: '板块类型', enum: ['INDUSTRY', 'CONCEPT'], required: false })
  type?: string;
}
```

- [ ] **Step 2: 创建 LimitUpDto**

```typescript
// server/src/modules/market/dto/limit-up.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt } from 'class-validator';

export class LimitUpQueryDto {
  @ApiProperty({ description: '日期，格式 YYYY-MM-DD', required: false })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiProperty({ description: '类型', enum: ['LIMIT_UP', 'LIMIT_DOWN', 'PREV_LIMIT_UP', 'STRONG', 'BROKEN'], default: 'LIMIT_UP' })
  @IsOptional()
  @IsString()
  type?: string = 'LIMIT_UP';

  @ApiProperty({ description: '页码', default: 1 })
  @IsOptional()
  @IsInt()
  page?: number = 1;

  @ApiProperty({ description: '每页数量', default: 50 })
  @IsOptional()
  @IsInt()
  pageSize?: number = 50;
}

export class LimitUpStockDto {
  @ApiProperty({ description: '股票代码' })
  code: string;

  @ApiProperty({ description: '股票名称' })
  name: string;

  @ApiProperty({ description: '涨跌幅 (%)' })
  changePct: number;

  @ApiProperty({ description: '最新价' })
  price: number;

  @ApiProperty({ description: '成交额' })
  amount: number;

  @ApiProperty({ description: '流通市值' })
  floatMarketCap?: number;

  @ApiProperty({ description: '换手率' })
  turnoverRate?: number;

  @ApiProperty({ description: '封板资金' })
  sealAmount?: number;

  @ApiProperty({ description: '连板数' })
  continueBoard?: number;

  @ApiProperty({ description: '所属行业' })
  industry?: string;
}
```

- [ ] **Step 3: 重写 MarketService**

```typescript
// server/src/modules/market/market.service.ts
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

    const where: any = { code, adjust };
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
    // 先尝试从 Redis 批量读取
    const snapshot = await this.realtimePush.getSnapshot(codes);
    if (snapshot.length > 0) {
      return snapshot;
    }

    // 降级：从数据库批量读取
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
  async getMinuteData(code: string, period: string, date?: string) {
    return this.dataGateway.getMinuteData({ code, period: period as any, date });
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
      date: date || new Date().toISOString().split('T')[0],
      time: time as any || '今日',
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
```

- [ ] **Step 4: 扩展 MarketController**

```typescript
// 在 server/src/modules/market/market.controller.ts 中添加新端点

// 导入新 DTO
import { SectorQueryDto } from './dto/sector.dto';
import { LimitUpQueryDto } from './dto/limit-up.dto';

// 添加端点（在 rankings 后添加）

@Get('minute/:code')
@ApiOperation({ summary: '获取分钟级数据（按需，不存储）' })
async getMinuteData(
  @Param('code') code: string,
  @Query('period') period: string = '5',
  @Query('date') date?: string,
) {
  const data = await this.marketService.getMinuteData(code, period, date);
  return { code: 0, message: 'success', data };
}

@Get('sectors')
@ApiOperation({ summary: '获取板块列表' })
async getSectors(@Query() query: SectorQueryDto) {
  const data = await this.marketService.getSectors(query);
  return { code: 0, message: 'success', data };
}

@Get('sectors/:id/stocks')
@ApiOperation({ summary: '获取板块成分股' })
async getSectorStocks(@Param('id') id: string) {
  const data = await this.marketService.getSectorStocks(id);
  return { code: 0, message: 'success', data };
}

@Get('sectors/:id/history')
@ApiOperation({ summary: '获取板块指数历史' })
async getSectorHistory(
  @Param('id') id: string,
  @Query('startDate') startDate?: string,
  @Query('endDate') endDate?: string,
) {
  const data = await this.marketService.getSectorHistory(id, startDate, endDate);
  return { code: 0, message: 'success', data };
}

@Get('limitup')
@ApiOperation({ summary: '获取涨停板数据' })
async getLimitUp(@Query() query: LimitUpQueryDto) {
  const result = await this.marketService.getLimitUp(query);
  return { code: 0, message: 'success', data: result };
}

@Get('hot')
@ApiOperation({ summary: '获取热搜股票' })
async getHotStocks(
  @Query('symbol') symbol?: string,
  @Query('date') date?: string,
  @Query('time') time?: string,
) {
  const data = await this.marketService.getHotStocks(symbol || 'A股', date || '', time || '今日');
  return { code: 0, message: 'success', data };
}
```

- [ ] **Step 5: 更新单元测试**

```typescript
// server/src/modules/market/market.service.spec.ts - 更新测试以适配新接口
import { Test, TestingModule } from '@nestjs/testing';
import { MarketService } from './market.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../services/redis.service';
import { DataGateway } from '../../services/data-gateway/data-gateway.service';
import { RealtimePushService } from './realtime-push.service';

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
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    sector: {
      findMany: jest.fn(),
    },
    sectorHistory: {
      findMany: jest.fn(),
    },
    sectorStock: {
      findMany: jest.fn(),
    },
    limitUp: {
      findFirst: jest.fn(),
    },
    limitUpStock: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    mget: jest.fn(),
  };

  const mockDataGateway = {
    getMinuteData: jest.fn(),
    getHotStocks: jest.fn(),
  };

  const mockRealtimePush = {
    getSnapshot: jest.fn(),
  };

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
        name: '浦发银行',
        price: 10.5,
        change: 0.1,
        changePct: 1.0,
        volume: 1000,
        amount: 10000,
        high: 10.8,
        low: 10.2,
        open: 10.4,
        prevClose: 10.4,
        updatedAt: new Date(),
      });

      const result = await service.getRealtime('600000');
      expect(result?.code).toBe('600000');
      expect(result?.price).toBe(10.5);
    });
  });

  describe('getRealtimeBatch', () => {
    it('should return from SSE snapshot first', async () => {
      const snapshot = [
        { code: '600000', price: 10.5 },
        { code: '000001', price: 12.0 },
      ];
      mockRealtimePush.getSnapshot.mockResolvedValue(snapshot);

      const result = await service.getRealtimeBatch(['600000', '000001']);
      expect(result).toHaveLength(2);
    });
  });
});
```

- [ ] **Step 6: 运行测试**

Run: `cd server && pnpm test -- market.service.spec.ts`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add server/src/modules/market/
git commit -m "feat(market): 重构MarketService，新增板块和涨停板查询"
```

---

## Task 6: Redis mget 支持批量读取

**Files:**
- Modify: `server/src/services/redis.service.ts`

- [ ] **Step 1: 扩展 RedisService 支持批量 mget**

当前 `RedisService` 的 `mget` 使用 `...keys` 展开，在 key 数量多时可能有参数限制问题。改为分批处理：

```typescript
// 在 server/src/services/redis.service.ts 中修改 mget 方法

async mgetBatch(keys: string[], batchSize = 50): Promise<(string | null)[]> {
  const results: (string | null)[] = [];
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    const batchResults = await this.client.mget(...batch);
    results.push(...batchResults);
  }
  return results;
}
```

在 `server/src/services/realtime-push.service.ts` 中更新 `getSnapshot` 使用 `mgetBatch`：

```typescript
async getSnapshot(codes: string[]): Promise<SystemRealtime[]> {
  if (codes.length === 0) return [];

  const keys = codes.map((code) => `realtime:${code}`);
  const values = await this.redis.mgetBatch(keys);  // 改为 mgetBatch

  return values
    .filter(Boolean)
    .map((v) => JSON.parse(v) as SystemRealtime);
}
```

- [ ] **Step 2: 提交**

```bash
git add server/src/services/redis.service.ts
git commit -m "perf(redis): 添加mgetBatch支持大批量key读取"
```

---

## Task 7: 构建验证

- [ ] **Step 1: 运行构建**

Run: `cd server && pnpm build`
Expected: BUILD SUCCESS，无 TypeScript 错误

- [ ] **Step 2: 验证迁移**

Run: `cd server && pnpm prisma migrate status`
Expected: 所有迁移已应用

- [ ] **Step 3: 启动服务**

Run: `cd server && pnpm start:dev`
Expected: 服务启动成功，无启动错误

- [ ] **Step 4: 手动测试 API**

```bash
# 股票列表
curl http://localhost:3000/api/v1/market/stocks?page=1&pageSize=5

# 实时行情
curl http://localhost:3000/api/v1/market/realtime/600000

# SSE 推送
curl -N http://localhost:3000/api/v1/market/sse/realtime?codes=600000,000001
```

- [ ] **Step 5: 运行所有测试**

Run: `cd server && pnpm test`
Expected: 所有测试通过

---

## 验证检查清单

- [ ] Prisma 迁移成功，新增 5 张表
- [ ] DataGateway 统一数据入口，各 Adapter 正确注册
- [ ] 定时任务启动：StockListUpdateJob / HistoryFillJob / WatchlistRealtimeJob / FullRealtimeJob / SectorUpdateJob / LimitUpUpdateJob
- [ ] SSE 端点 `/api/v1/market/sse/realtime?codes=...` 正常推送数据
- [ ] 新增 API 端点：minute / sectors / sectors/:id/stocks / sectors/:id/history / limitup / hot
- [ ] 单元测试全部通过
- [ ] 服务启动无错误
- [ ] 代码已提交
