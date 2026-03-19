# 行情模块重构设计方案

> **创建时间：** 2026-03-19
> **状态：** 已评审
> **版本：** v1.1

## 1. 背景与目标

当前行情模块（Market）存在以下问题：
- `RealtimeUpdateJob` 未注册，从未运行
- 数据模型不完整，缺少板块、涨停板等数据
- 实时数据采集策略不完善，只有定时轮询全量数据
- 前端无法获取实时推送

本次重构目标：
1. 全量重构行情数据层，重建数据采集、存储、推送体系
2. 支持自选股高频轮询（10秒）+ 全量低频兜底（1分钟）
3. 接入 SSE 实时推送，前端自动接收行情更新
4. 新增板块数据（行业/概念）和涨停板数据的定时采集与存储
5. 扩展前端字段，保留现有样式不变

---

## 2. 数据采集范围

### 2.1 实时行情

| 数据项 | 数据源 | 存储策略 |
|--------|--------|----------|
| 股票实时价格 | `stock_zh_a_spot_em` | 定时存储 + Redis 缓存 |
| 买卖盘口（5档） | `stock_bid_ask_em` | 随 RealtimeData 存储 |
| 实时涨跌幅排行榜 | `stock_zh_a_spot_em` | 按需计算 |
| 百度热搜 | `stock_hot_search_baidu` | 按需查询，不存储 |

### 2.2 历史行情

| 数据项 | 数据源 | 存储策略 |
|--------|--------|----------|
| 日/周/月 K线 | `stock_zh_a_hist` | 盘后定时补全，MySQL 持久化 |
| 前复权/后复权 | `stock_zh_a_hist` (adjust参数) | 随历史数据存储 |
| 分钟级数据 | `stock_zh_a_minute` | **按需查询，不存储** |

### 2.3 板块数据

| 数据项 | 数据源 | 存储策略 |
|--------|--------|----------|
| 行业板块一览 | `stock_board_industry_summary_ths` | 每5分钟定时存储 |
| 行业板块指数历史 | `stock_board_industry_index_ths` | 每5分钟定时存储 |
| 概念板块指数历史 | `stock_board_concept_index_ths` | 每5分钟定时存储 |
| 概念板块简介 | `stock_board_concept_info_ths` | 按需查询 |

### 2.4 涨停板数据

| 数据项 | 数据源 | 存储策略 |
|--------|--------|----------|
| 涨停股池 | `stock_zt_pool_em` | 每10分钟定时存储 |
| 昨日涨停 | `stock_zt_pool_previous_em` | 每10分钟定时存储 |
| 强势股池 | `stock_zt_pool_strong_em` | 每10分钟定时存储 |
| 炸板股池 | `stock_zt_pool_zbgc_em` | 每10分钟定时存储 |
| 跌停股池 | `stock_zt_pool_dtgc_em` | 每10分钟定时存储 |

---

## 3. 数据库 Schema 设计

### 3.1 新增表

#### Sector（板块表）

```prisma
model Sector {
  id        String      @id @default(uuid())
  code      String      @unique  // 板块代码，如同花顺行业代码
  name      String                // 板块名称
  type      SectorType           // INDUSTRY | CONCEPT
  parentId  String?              // 父板块ID（用于层级结构）
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  stocks    SectorStock[]
  history   SectorHistory[]
}
```

#### SectorHistory（板块指数历史）

```prisma
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
```

#### SectorStock（板块-成分股关联）

```prisma
model SectorStock {
  sectorId   String
  stockCode  String
  addedAt    DateTime @default(now())

  sector     Sector   @relation(fields: [sectorId], references: [id], onDelete: Cascade)
  stock      Stock    @relation(fields: [stockCode], references: [code], onDelete: Cascade)

  @@id([sectorId, stockCode])
}
```

#### LimitUp（涨停板记录）

```prisma
model LimitUp {
  id        String       @id @default(uuid())
  date      DateTime
  type      LimitUpType  // LIMIT_UP | LIMIT_DOWN | PREV_LIMIT_UP | STRONG | BROKEN
  createdAt DateTime     @default(now())

  stocks    LimitUpStock[]

  @@unique([date, type])
  @@index([date])
}
```

#### LimitUpStock（涨停板成分股）

```prisma
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

### 3.2 修改表

#### Stock（扩展字段）

> **说明：** 现有字段包括 `code`(PK), `name`, `market`, `industry?`, `history`, `realtime`。以下为新增/扩展字段：

```prisma
model Stock {
  // 现有字段 code, name, market, industry?, history, realtime...
  totalShares    Float?    // 总股本
  floatShares    Float?    // 流通股本
  listDate       DateTime? // 上市日期

  // 新增关联
  sectors        SectorStock[]
  limitUpStocks  LimitUpStock[]
}
```

#### RealtimeData（增强字段）

> **说明：** 现有字段包括 `code`(PK), `price`, `change`, `changePct`, `volume`, `amount`, `high`, `low`, `open`, `prevClose`, `bid1`, `ask1`, `updatedAt`。以下为新增字段：

```prisma
model RealtimeData {
  // 现有字段 code, price, change, changePct, volume, amount, high, low, open, prevClose, bid1, ask1, updatedAt...
  amplitude      Float?    // 振幅 (%)
  turnoverRate   Float?    // 换手率 (%)
  pe             Float?    // 市盈率（动态）
  pb             Float?    // 市净率
  marketCap      Float?    // 总市值
  floatMarketCap Float?    // 流通市值
  bidAsk         Json?     // 五档买卖盘 { bid1: {price, vol}, ..., ask1: {...} }
}
```

---

## 4. 服务层设计

### 4.1 AkshareService（重构）

```typescript
// 主要方法
class AkshareService {
  // 股票列表
  fetchStockList(): Promise<StockBasic[]>

  // 历史行情
  fetchHistoryData(code, startDate, endDate, adjust): Promise<HistoryItem[]>

  // 实时行情
  fetchRealtimeData(codes: string[]): Promise<RealtimeItem[]>
  fetchBidAsk(code: string): Promise<BidAskItem>

  // 分钟级数据（按需）
  fetchMinuteData(code, period, date): Promise<MinuteItem[]>

  // 板块数据
  fetchIndustryBoard(): Promise<IndustryBoardItem[]>
  fetchConceptBoard(symbol): Promise<ConceptBoardItem[]>

  // 涨停板数据
  fetchLimitUpPool(date): Promise<LimitUpStockItem[]>
  fetchLimitUpPrevious(date): Promise<LimitUpStockItem[]>
  fetchStrongStocks(date): Promise<LimitUpStockItem[]>
  fetchBrokenStocks(date): Promise<LimitUpStockItem[]>
  fetchLimitDownPool(date): Promise<LimitUpStockItem[]>

  // 热搜
  fetchHotStocks(symbol, date, time): Promise<HotStockItem[]>

  // 通用
  fetchWithRetry<T>(fn, maxRetries): Promise<T | null>
}
```

### 4.2 RealtimePushService（SSE 推送）

```typescript
// 核心设计：RxJS Subject 管理多订阅者
@Injectable()
export class RealtimePushService {
  private subject = new Subject<RealtimeUpdate>();

  // SSE 端点
  @Sse('sse/realtime')
  sse(@Query('codes') codes: string) {
    // codes: 逗号分隔的股票代码
    // 返回 Observable<MessageEvent>
  }

  // 推送数据（供 Job 调用）
  push(update: RealtimeUpdate): void {
    this.subject.next(update);
  }

  // 获取订阅者数据（从 Redis 批量读取）
  // Redis Key 策略: `realtime:{code}` → TTL: 120秒
  // 数据格式: JSON string of RealtimeUpdate
  getSnapshot(codes: string[]): RealtimeUpdate[]
}
```

### 4.3 MarketService（重构）

```typescript
class MarketService {
  // 股票查询
  getStockList(query: StockListQuery): Promise<PaginatedResult<Stock>>
  getStock(code: string): Promise<Stock | null>

  // 历史行情
  getHistory(query: HistoryQuery): Promise<HistoryData[]>

  // 实时行情
  getRealtime(code: string): Promise<RealtimeData | null>
  getRealtimeBatch(codes: string[]): Promise<RealtimeData[]>

  // 排行榜
  getRankings(type: 'up' | 'down', limit: number): Promise<Stock[]>

  // 板块
  getSectors(type?: SectorType): Promise<Sector[]>
  getSectorStocks(sectorId: string): Promise<Stock[]>
  getSectorHistory(sectorId: string, startDate?: string, endDate?: string): Promise<SectorHistory[]>

  // 涨停板
  getLimitUp(date: string, type: LimitUpType): Promise<LimitUpStock[]>
  getLimitUpHistory(type: LimitUpType, days: number): Promise<LimitUp[]>

  // 热搜
  getHotStocks(symbol: string, date: string, time: string): Promise<HotStock[]>
}
```

---

## 5. 定时任务设计

### 5.1 任务列表

| 任务 | Cron 表达式 | 说明 |
|------|-----------|------|
| StockListUpdateJob | `0 9 * * 1-5` | 每日9:00 更新股票列表 |
| HistoryFillJob | `0 16 * * 1-5` | 每日16:00 补全历史K线 |
| WatchlistRealtimeJob | `@Interval(10000)` | **自选股10秒高频轮询** |
| FullRealtimeJob | `@Interval(60000)` | **全量1分钟轮询兜底** |
| SectorUpdateJob | `*/5 9-15 * * 1-5` | **盘中每5分钟板块数据** |
| LimitUpUpdateJob | `*/10 9-15 * * 1-5` | **盘中每10分钟涨停板** |
| RealtimeCleanupJob | `0 16 * * 1-5` | 盘后清理 Redis 缓存 |

### 5.2 WatchlistRealtimeJob 逻辑

```typescript
@Interval(10000) // 每10秒
async updateWatchlistRealtime() {
  // 1. 从数据库读取所有自选股代码
  const watchlists = await this.prisma.watchlist.findMany({
    include: { stocks: true }
  });

  // 2. 去重，批量请求实时数据
  const codes = [...new Set(watchlists.flatMap(w => w.stocks.map(s => s.stockCode))];

  // 3. 批量采集 + 存储 + Redis缓存
  // ...

  // 4. 推送 SSE
  this.realtimePushService.push({ codes, data });
}
```

---

## 6. API 设计

### 6.1 REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/market/stocks` | 股票列表（分页） |
| GET | `/api/v1/market/stocks/:code` | 股票详情 |
| GET | `/api/v1/market/history/:code` | 历史K线 |
| GET | `/api/v1/market/realtime/:code` | 单股实时行情 |
| GET | `/api/v1/market/realtime/batch` | 批量实时行情 |
| GET | `/api/v1/market/rankings` | 涨跌幅排行 |
| GET | `/api/v1/market/minute/:code` | 分钟级数据（按需） |
| GET | `/api/v1/market/sectors` | 板块列表 |
| GET | `/api/v1/market/sectors/:id/stocks` | 板块成分股 |
| GET | `/api/v1/market/sectors/:id/history` | 板块指数历史 |
| GET | `/api/v1/market/limitup` | 涨停板数据 |
| GET | `/api/v1/market/hot` | 热搜股票 |

### 6.2 SSE API

| 路径 | 参数 | 说明 |
|------|------|------|
| GET | `/api/v1/market/sse/realtime?codes=600000,000001` | 订阅指定股票的实时行情推送 |

响应格式：
```
data: {"code":"600000","price":10.5,"changePct":2.3,...}

data: {"code":"000001","price":12.3,"changePct":-1.5,...}
```

---

## 7. 前端设计

### 7.1 现有页面保留

- `web/src/pages/Market.tsx` — 保留现有样式不变
- `web/src/components/charts/KLineChart.tsx` — 复用
- `web/src/mocks/handlers/market.ts` — 保留 Mock，按需更新

### 7.2 新增功能（字段扩展）

| 页面位置 | 新增字段 | 数据来源 |
|----------|----------|----------|
| 股票列表 | 市盈率、市净率、换手率、总市值 | RealtimeData |
| 个股详情 | 五档盘口、振幅、流通市值 | RealtimeData + BidAsk |
| 涨跌幅排行 | 60日涨跌幅、年初至今涨跌幅 | RealtimeData |
| 板块入口 | 行业/概念板块列表 | Sector API |
| 涨停板入口 | 涨停/跌停/强势股/炸板 | LimitUp API |

### 7.3 SSE 接入

```typescript
// hooks/useRealtimeSSE.ts
function useRealtimeSSE(codes: string[]) {
  const [data, setData] = useState<Map<string, RealtimeData>>(new Map());

  useEffect(() => {
    const eventSource = new EventSource(`/api/v1/market/sse/realtime?codes=${codes.join(',')}`);

    eventSource.onmessage = (event) => {
      const update = JSON.parse(event.data);
      setData(prev => new Map(prev).set(update.code, update));
    };

    // 断线自动重连
    eventSource.onerror = () => {
      eventSource.close();
      setTimeout(() => {
        // React 会自动重新触发 useEffect，重新创建连接
      }, 3000);
    };

    return () => eventSource.close();
  }, [codes]);

  return data;
}
```

---

## 8. 任务拆分

| Phase | 任务 | 优先级 | 说明 |
|-------|------|--------|------|
| **P1** | 数据库 Schema 重构 | P0 | 新增 Sector/LimitUp 等表，修改 Stock/RealtimeData |
| **P2** | AkshareService 重构 | P0 | 新增所有数据接口方法 |
| **P3** | 定时任务重构 | P0 | 股票列表 + 历史补全 + 增量轮询 |
| **P4** | SSE 推送服务 | P0 | RealtimePushService + SSE Controller |
| **P5** | MarketService 重构 | P0 | 适配新 Schema 和接口 |
| **P6** | 板块数据采集 | P1 | 行业/概念板块定时采集 |
| **P7** | 涨停板数据采集 | P1 | 涨停板数据定时采集 |
| **P8** | 前端 SSE 接入 | P0 | 自选股列表实时更新 |
| **P9** | 前端字段扩展 | P1 | 跟随后端新增字段，保留样式 |

---

## 9. 技术选型

| 技术 | 用途 | 版本 |
|------|------|------|
| NestJS | 后端框架 | 最新稳定版 |
| Prisma | ORM | 5.x |
| MySQL | 关系数据库 | via Docker |
| Redis | 实时数据缓存 | via Docker |
| RxJS | SSE 流管理 | 随 NestJS |
| SSE | 实时推送 | 原生支持 |
| React | 前端框架 | 18.x |
| TradingView Lightweight Charts | K线图 | 最新 |

---

## 10. 数据质量保障

### 10.1 校验规则

- 价格合理性：最高 >= 最低，当前价在 [最低, 最高] 范围内
- 涨跌幅校验：`(最新价 - 昨收) / 昨收 ≈ 涨跌幅`
- 停牌标记：当日成交量为0时，标记为停牌

### 10.2 异常处理

- 接口限流：所有请求间隔 >= 500ms
- 重试机制：失败自动重试3次，指数退避
- 降级策略：某数据源失败时，尝试备用数据源

---

## 11. 待确认事项

1. [ ] 基本面数据（财务指标、PE、PB等）是否需要接入？本次暂不包含
2. [ ] 分钟级历史数据保留多久？本次不存储，按需查询
3. [ ] 前端是否需要登录/用户体系？暂不考虑，多用户后续扩展
