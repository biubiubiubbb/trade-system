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
## Task 2: 数据源网关（DataGateway）

> **架构说明：** 所有数据通过本地运行的 `aktools` 服务（Python FastAPI）调用 akshare 获取，不直接爬取网页。aktools 通过 Docker Compose 启动，与 NestJS 后端在同一个 Docker 网络中，通过 `http://aktools:8080/api/public/{函数名}` 调用。

**Files:**
- Create: `server/src/services/data-gateway/types.ts`
- Create: `server/src/services/data-gateway/adapters/aktools.adapter.ts`
- Create: `server/src/services/data-gateway/data-gateway.service.ts`
- Modify: `server/src/services/services.module.ts`
- Modify: `server/docker-compose.yml`
- Delete: `server/src/services/akshare.service.ts`

- [ ] **Step 1: 创建统一类型定义**

> types.ts 保持不变（SystemXxx 接口是系统标准数据结构），只需修改 `HotParams`：

```typescript
// server/src/services/data-gateway/types.ts
// === 系统标准数据结构（不变，略）===

// === 请求参数类型 ===
export interface HistoryParams {
  code: string;
  startDate: string; // YYYYMMDD 格式
  endDate: string;   // YYYYMMDD 格式
  adjust?: 'None' | 'Forward' | 'Backward';
}

export interface MinuteParams {
  code: string;
  period: '1' | '5' | '15' | '30' | '60';
}

export interface HotParams {
  symbol: string; // 默认 'A股'
}
```

- [ ] **Step 2: 创建 AktoolsAdapter（调用本地 akshare HTTP API）**

> aktools 启动方式：`python -m aktools`（Docker 容器内），监听 `http://0.0.0.0:8080`。
> akshare DataFrame 通过 HTTP 返回为 `{headers: string[], data: any[][]}` 结构。
> ⚠️ 以下字段映射基于 akshare 文档，实际返回字段名需启动 aktools 后通过 curl 验证。

```typescript
// server/src/services/data-gateway/adapters/aktools.adapter.ts
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

interface AktoolsDataFrame {
  headers: string[];
  data: any[][];
}

@Injectable()
export class AktoolsAdapter {
  private readonly logger = new Logger(AktoolsAdapter.name);
  private readonly client: AxiosInstance;

  constructor() {
    // aktools 服务地址：Docker Compose 中服务名为 aktools
    const baseUrl = process.env.AKTOOLS_URL || 'http://aktools:8080';
    this.client = axios.create({ baseURL: baseUrl, timeout: 60000 });
  }

  isAvailable(): boolean { return true; }

  // 将 DataFrame 转为对象数组
  private dfToObjects<T>(df: AktoolsDataFrame): T[] {
    if (!df?.headers || !df?.data) return [];
    return df.data.map((row) => {
      const obj: any = {};
      df.headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj as T;
    });
  }

  // === 实时行情（stock_zh_a_spot_em）===
  async fetchRealtime(codes: string[]): Promise<import('../types').SystemRealtime[]> {
    const df = await this.client.get('/api/public/stock_zh_a_spot_em').then(r => r.data as AktoolsDataFrame);
    const rows = this.dfToObjects<any>(df);
    return rows.filter((r) => codes.includes(r['代码'])).map((r) => ({
      code: r['代码'] || '',
      name: r['名称'] || '',
      price: parseFloat(r['最新价']) || 0,
      change: parseFloat(r['涨跌额']) || 0,
      changePct: parseFloat(r['涨跌幅']) || 0,
      volume: parseFloat(r['成交量']) || 0,
      amount: parseFloat(r['成交额']) || 0,
      high: parseFloat(r['最高']) || 0,
      low: parseFloat(r['最低']) || 0,
      open: parseFloat(r['今开']) || 0,
      prevClose: parseFloat(r['昨收']) || 0,
      amplitude: parseFloat(r['振幅']) || 0,
      turnoverRate: parseFloat(r['换手率']) || 0,
      pe: parseFloat(r['市盈率-动态']) || 0,
      pb: parseFloat(r['市净率']) || 0,
      marketCap: parseFloat(r['总市值']) || 0,
      floatMarketCap: parseFloat(r['流通市值']) || 0,
      bidAsk: null,
      updatedAt: new Date(),
    }));
  }

  // === 买卖盘口（stock_bid_ask_em）===
  async fetchBidAsk(code: string): Promise<import('../types').SystemBidAsk | null> {
    const df = await this.client.get('/api/public/stock_bid_ask_em', { params: { symbol: code } }).then(r => r.data as AktoolsDataFrame);
    const rows = this.dfToObjects<any>(df);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      bid1: { price: parseFloat(r['买一']) || 0, vol: parseFloat(r['买一量']) || 0 },
      bid2: { price: parseFloat(r['买二']) || 0, vol: parseFloat(r['买二量']) || 0 },
      bid3: { price: parseFloat(r['买三']) || 0, vol: parseFloat(r['买三量']) || 0 },
      bid4: { price: parseFloat(r['买四']) || 0, vol: parseFloat(r['买四量']) || 0 },
      bid5: { price: parseFloat(r['买五']) || 0, vol: parseFloat(r['买五量']) || 0 },
      ask1: { price: parseFloat(r['卖一']) || 0, vol: parseFloat(r['卖一量']) || 0 },
      ask2: { price: parseFloat(r['卖二']) || 0, vol: parseFloat(r['卖二量']) || 0 },
      ask3: { price: parseFloat(r['卖三']) || 0, vol: parseFloat(r['卖三量']) || 0 },
      ask4: { price: parseFloat(r['卖四']) || 0, vol: parseFloat(r['卖四量']) || 0 },
      ask5: { price: parseFloat(r['卖五']) || 0, vol: parseFloat(r['卖五量']) || 0 },
    };
  }

  // === 历史行情（stock_zh_a_hist）===
  async fetchHistory(params: import('../types').HistoryParams): Promise<import('../types').SystemHistory[]> {
    const df = await this.client.get('/api/public/stock_zh_a_hist', {
      params: {
        symbol: params.code,
        period: 'daily',
        start_date: params.startDate,
        end_date: params.endDate,
        adjust: params.adjust === 'Forward' ? 'qfq' : params.adjust === 'Backward' ? 'hfq' : '',
      },
    }).then(r => r.data as AktoolsDataFrame);
    return this.dfToObjects<any>(df).map((r) => ({
      code: params.code,
      date: new Date(r['日期']),
      open: parseFloat(r['开盘']) || 0,
      close: parseFloat(r['收盘']) || 0,
      high: parseFloat(r['最高']) || 0,
      low: parseFloat(r['最低']) || 0,
      volume: parseFloat(r['成交量']) || 0,
      amount: parseFloat(r['成交额']) || 0,
      turnover: parseFloat(r['换手率']) || 0,
      adjust: params.adjust ?? 'None',
    }));
  }

  // === 分时数据（stock_intraday_sina）===
  async fetchMinute(code: string): Promise<import('../types').SystemMinute[]> {
    const df = await this.client.get('/api/public/stock_intraday_sina', {
      params: { symbol: code },
    }).then(r => r.data as AktoolsDataFrame);
    return this.dfToObjects<any>(df).map((r) => ({
      time: r['时间'],
      price: parseFloat(r['当前价格']) || 0,
      volume: parseFloat(r['成交量']) || 0,
      amount: parseFloat(r['成交额']) || 0,
    }));
  }

  // === 行业板块（stock_board_industry_summary_ths）===
  async fetchIndustryBoard(): Promise<import('../types').SystemIndustryBoard[]> {
    const df = await this.client.get('/api/public/stock_board_industry_summary_ths').then(r => r.data as AktoolsDataFrame);
    return this.dfToObjects<any>(df).map((r) => ({
      name: r['板块名称'] || '',
      changePct: parseFloat(r['涨跌幅']) || 0,
      volume: parseFloat(r['成交量']) || 0,
      amount: parseFloat(r['成交额']) || 0,
      netInflow: parseFloat(r['主力净流入']) || 0,
      riseCount: parseInt(r['上涨数']) || 0,
      fallCount: parseInt(r['下跌数']) || 0,
      leaderStock: r['领涨股票'] || '',
      leaderStockPrice: parseFloat(r['领涨股票最新价']) || 0,
      leaderStockChangePct: parseFloat(r['领涨股票涨跌幅']) || 0,
    }));
  }

  // === 概念板块（stock_board_concept_ths）===
  async fetchConceptBoard(): Promise<import('../types').SystemConceptBoard[]> {
    const df = await this.client.get('/api/public/stock_board_concept_ths').then(r => r.data as AktoolsDataFrame);
    return this.dfToObjects<any>(df).map((r) => ({
      name: r['板块名称'] || '',
      changePct: parseFloat(r['涨跌幅']) || 0,
      date: new Date(),
      open: 0, high: 0, low: 0, close: 0,
      volume: parseFloat(r['成交量']) || 0,
      amount: parseFloat(r['成交额']) || 0,
    }));
  }

  // === 涨停股池（stock_zt_pool_em）===
  async fetchLimitUpPool(date: string): Promise<import('../types').SystemLimitUpStock[]> {
    const df = await this.client.get('/api/public/stock_zt_pool_em', { params: { date } }).then(r => r.data as AktoolsDataFrame);
    return this.dfToObjects<any>(df).map((r) => ({
      code: r['代码'] || '',
      name: r['名称'] || '',
      changePct: parseFloat(r['涨跌幅']) || 0,
      price: parseFloat(r['最新价']) || 0,
      amount: parseFloat(r['成交额']) || 0,
      floatMarketCap: parseFloat(r['流通市值']) || 0,
      totalMarketCap: parseFloat(r['总市值']) || 0,
      turnoverRate: parseFloat(r['换手率']) || 0,
      sealAmount: parseFloat(r['封单额']) || 0,
      firstSealTime: r['首次封板时间'] || undefined,
      lastSealTime: r['最后封板时间'] || undefined,
      brokenCount: parseInt(r['炸板次数']) || 0,
      continueBoard: parseInt(r['连板数']) || 0,
      industry: r['所属行业'] || '',
    }));
  }

  // === 跌停股池 ===
  async fetchLimitDownPool(date: string): Promise<import('../types').SystemLimitUpStock[]> {
    const df = await this.client.get('/api/public/stock_zt_pool_em', { params: { date } }).then(r => r.data as AktoolsDataFrame);
    return this.dfToObjects<any>(df)
      .filter((r) => parseFloat(r['涨跌幅']) <= -9.9)
      .map((r) => ({
        code: r['代码'] || '', name: r['名称'] || '',
        changePct: parseFloat(r['涨跌幅']) || 0,
        price: parseFloat(r['最新价']) || 0,
        amount: parseFloat(r['成交额']) || 0,
        floatMarketCap: parseFloat(r['流通市值']) || 0,
        totalMarketCap: parseFloat(r['总市值']) || 0,
        turnoverRate: parseFloat(r['换手率']) || 0,
        sealAmount: parseFloat(r['封单额']) || 0,
        continueBoard: 0, industry: r['所属行业'] || '',
      }));
  }

  // === 强势股池 ===
  async fetchStrongStocks(date: string): Promise<import('../types').SystemLimitUpStock[]> {
    try {
      const df = await this.client.get('/api/public/stock_zt_pool_strong_em', { params: { date } }).then(r => r.data as AktoolsDataFrame);
      return this.dfToObjects<any>(df).map((r) => ({
        code: r['代码'] || '', name: r['名称'] || '',
        changePct: parseFloat(r['涨跌幅']) || 0,
        price: parseFloat(r['最新价']) || 0,
        amount: parseFloat(r['成交额']) || 0,
        continueBoard: parseInt(r['连板数']) || 0,
        industry: r['所属行业'] || '',
      }));
    } catch { return []; }
  }

  // === 热搜（stock_hot_search_baidu）===
  async fetchHotStocks(params: import('../types').HotParams): Promise<import('../types').SystemHotStock[]> {
    const df = await this.client.get('/api/public/stock_hot_search_baidu', { params: { symbol: params.symbol || 'A股' } }).then(r => r.data as AktoolsDataFrame);
    return this.dfToObjects<any>(df).map((r) => ({
      name: r['股票名称'] || '', code: r['股票代码'] || '',
      changePct: r['涨跌幅'] || '0',
      heat: parseInt(r['热度']) || 0,
    }));
  }

  // === 股票列表（stock_zh_a_spot_em 全量）===
  async fetchStockList(): Promise<import('../types').SystemStock[]> {
    const df = await this.client.get('/api/public/stock_zh_a_spot_em').then(r => r.data as AktoolsDataFrame);
    return this.dfToObjects<any>(df).map((r) => ({
      code: r['代码'] || '',
      name: r['名称'] || '',
      market: (r['代码'] || '').startsWith('6') ? 'SH' : 'SZ',
      industry: r['所属行业'] || undefined,
    }));
  }

  // === 超跌股池（暂无专属接口，暂用涨停池过滤近似超跌）===
  async fetchBrokenStocks(date: string): Promise<import('../types').SystemLimitUpStock[]> {
    // TODO: akshare 有超跌股专属接口后替换
    this.logger.warn('fetchBrokenStocks not implemented - returning empty');
    return [];
  }
}
```

- [ ] **Step 3: 创建 DataGateway 服务**

```typescript
// server/src/services/data-gateway/data-gateway.service.ts
import { Injectable } from '@nestjs/common';
import { AktoolsAdapter } from './adapters/aktools.adapter';
import {
  SystemStock,
  SystemRealtime,
  SystemBidAsk,
  SystemHistory,
  SystemMinute,
  SystemIndustryBoard,
  SystemConceptBoard,
  SystemLimitUpStock,
  SystemHotStock,
  HistoryParams,
  HotParams,
} from './types';

@Injectable()
export class DataGateway {
  constructor(private readonly aktools: AktoolsAdapter) {}

  async getStockList() { return this.aktools.fetchStockList(); }
  async getRealtime(codes: string[]) { return this.aktools.fetchRealtime(codes); }
  async getBidAsk(code: string) { return this.aktools.fetchBidAsk(code); }
  async getHistory(params: HistoryParams) { return this.aktools.fetchHistory(params); }
  async getMinuteData(code: string) { return this.aktools.fetchMinute(code); }  // 别名：jobs 使用 getMinuteData
  async getMinute(code: string) { return this.aktools.fetchMinute(code); }
  async getIndustryBoard() { return this.aktools.fetchIndustryBoard(); }
  async getConceptBoard() { return this.aktools.fetchConceptBoard(); }
  async getLimitUpPool(date: string) { return this.aktools.fetchLimitUpPool(date); }
  async getLimitDownPool(date: string) { return this.aktools.fetchLimitDownPool(date); }
  async getStrongStocks(date: string) { return this.aktools.fetchStrongStocks(date); }
  async getBrokenStocks(date: string) { return this.aktools.fetchBrokenStocks(date); }
  async getHotStocks(params: HotParams) { return this.aktools.fetchHotStocks(params); }
}
```

- [ ] **Step 4: 更新 ServicesModule**

```typescript
// server/src/services/services.module.ts
import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { AktoolsAdapter } from './data-gateway/adapters/aktools.adapter';
import { DataGateway } from './data-gateway/data-gateway.service';

@Module({
  providers: [RedisService, AktoolsAdapter, DataGateway],
  exports: [RedisService, DataGateway],
})
export class ServicesModule {}
```

- [ ] **Step 5: 添加 aktools 到 Docker Compose**

```yaml
# server/docker-compose.yml 新增 aktools 服务
  aktools:
    image: python:3.11-slim
    container_name: trade_system_aktools
    working_dir: /app
    command: >
      bash -c "pip install akshare aktools --quiet && python -m aktools --host 0.0.0.0 --port 8080"
    ports:
      - "8080:8080"  # 开发时暴露，方便 curl 验证
    volumes:
      - aktools_cache:/root/.akshare
    networks:
      - trade_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

networks:
  trade_network:
    driver: bridge
```

- [ ] **Step 6: 提交**

```bash
git add server/docker-compose.yml server/src/services/data-gateway/
git add server/src/services/services.module.ts
git rm server/src/services/akshare.service.ts
git commit -m "refactor(market): 基于aktools重构DataGateway，统一数据源架构"
```

> **注意：** 首次启动 `docker-compose up -d aktools` 后，通过 `curl http://localhost:8080/api/public/stock_zh_a_spot_em` 验证 API 可用性，并确认返回字段名（headers）。若字段名与代码中的中文 key 不匹配，需修正 AktoolsAdapter 中的字段映射。

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

  // Cron: 每5分钟执行一次，工作日（周一到周五），限制在交易时段 9:00-15:00
  @Cron('*/5 9-15 * * 1-5')
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
  // 每条 SSE 消息一个 JSON 对象，前端按行解析
  sse(codes: string[]): Observable<MessageEvent> {
    const codeSet = codes?.length > 0 ? new Set(codes) : null;

    return this.subject.asObservable().pipe(
      flatMap((event) => {
        const items = codeSet
          ? event.data.filter((d) => codeSet.has(d.code))
          : event.data;

        // 每个股票生成一条 SSE 消息，前端按 \n 分割逐行解析
        return items.map((d) => new MessageEvent('message', { data: JSON.stringify(d) }));
      }),
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

  @ApiProperty({ description: '总市值' })
  totalMarketCap?: number;

  @ApiProperty({ description: '换手率' })
  turnoverRate?: number;

  @ApiProperty({ description: '封板资金' })
  sealAmount?: number;

  @ApiProperty({ description: '首次封板时间' })
  firstSealTime?: string;

  @ApiProperty({ description: '最后封板时间' })
  lastSealTime?: string;

  @ApiProperty({ description: '炸板次数' })
  brokenCount?: number;

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
) {
  const data = await this.marketService.getMinuteData(code);
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
