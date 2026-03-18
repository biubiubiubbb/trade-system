# A股交易系统 - 设计文档

**日期**：2026-03-18
**状态**：草稿

---

## 一、项目概述

### 1.1 项目目标

构建一个面向个人用户的A股模拟交易系统，支持：
- 全A股历史行情数据存储与查询（2015年至今）
- 多账户独立模拟交易管理
- 策略回测与收益分析
- 交易心得记录与复盘

### 1.2 使用场景

- 个人用户进行交易策略回测验证
- 模拟盘练习，不涉及真实交易
- 交易记录与分析

### 1.3 核心约束

- 纯模拟交易，不连接券商API
- 数据来源：akshare（免费数据源）
- 个人使用，单用户架构

---

## 二、技术架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                      前端 (Web)                          │
│         React 18 + TypeScript + Vite                     │
│    TailwindCSS + Radix UI + ECharts + Zustand           │
└─────────────────────┬───────────────────────────────────┘
                      │ REST API
┌─────────────────────▼───────────────────────────────────┐
│                      后端 (API)                         │
│            NestJS + TypeScript                          │
│    Prisma ORM + MySQL + Redis + node-cron              │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
┌───────────────┐          ┌───────────────┐
│    MySQL      │          │    Redis      │
│   数据库       │          │    缓存       │
└───────────────┘          └───────────────┘
        │
        ▼
┌───────────────┐
│   akshare     │
│   数据源       │
└───────────────┘
```

### 2.2 技术选型明细

#### 后端技术栈

| 层级 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| 运行时 | Node.js | 20 LTS | 稳定可靠 |
| 开发语言 | TypeScript | 5.x | 类型安全 |
| Web框架 | NestJS | 10.x | 模块化、DI支持 |
| ORM | Prisma | 5.x | 数据库操作便捷 |
| 数据库 | MySQL | 8.x | 主数据存储 |
| 缓存 | Redis | 7.x | 实时行情缓存 |
| HTTP客户端 | axios | 1.x | 调用akshare |
| 任务调度 | @nestjs/schedule | - | 定时任务 |
| API文档 | @nestjs/swagger | - | OpenAPI文档 |
| 验证 | class-validator | - | DTO验证 |

#### 前端技术栈

| 层级 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| 框架 | React | 18.x | UI框架 |
| 开发语言 | TypeScript | 5.x | 类型安全 |
| 构建工具 | Vite | 5.x | 快速构建 |
| 路由 | React Router | 6.x | SPA路由 |
| UI框架 | TailwindCSS | 3.x | 原子化CSS |
| 组件库 | Radix UI | - | 无样式组件库 |
| 图表 | ECharts | 5.x | K线图、统计图 |
| 主题系统 | TailwindCSS + CSS Variables | - | 多主题支持 |
| 状态管理 | Zustand | 4.x | 轻量状态管理 |
| HTTP客户端 | axios | 1.x | API调用 |
| Mock | MSW | 2.x | 接口Mock |
| 数据生成 | @faker-js/faker | - | Mock数据 |

#### 开发工具

| 用途 | 工具 | 说明 |
|------|------|------|
| 包管理 | pnpm | 高效节约磁盘 |
| 开发环境 | Docker Compose | 一键启动MySQL/Redis |
| 代码规范 | ESLint + Prettier | 统一代码风格 |
| Git规范 | Conventional Commits | 规范化提交信息 |

### 2.3 项目结构

```
trade-system/
├── server/                          # 后端项目
│   ├── src/
│   │   ├── main.ts                  # 入口文件
│   │   ├── app.module.ts            # 根模块
│   │   ├── common/                  # 公共模块
│   │   │   ├── decorators/          # 自定义装饰器
│   │   │   ├── filters/             # 异常过滤器
│   │   │   ├── interceptors/        # 拦截器
│   │   │   └── utils/               # 工具函数
│   │   ├── modules/                 # 功能模块
│   │   │   ├── account/             # 账户模块
│   │   │   ├── trade/               # 交易模块
│   │   │   ├── position/            # 持仓模块
│   │   │   ├── market/              # 行情模块
│   │   │   ├── strategy/            # 策略模块
│   │   │   ├── backtest/            # 回测模块
│   │   │   └── note/                # 心得笔记模块
│   │   ├── services/                # 业务服务
│   │   ├── jobs/                    # 定时任务
│   │   └── database/                # 数据库相关
│   ├── prisma/
│   │   ├── schema.prisma            # 数据模型
│   │   └── seed/                    # 种子数据
│   ├── test/                        # 测试
│   ├── Dockerfile
│   └── docker-compose.yml
├── web/                             # 前端项目
│   ├── src/
│   │   ├── main.tsx                 # 入口文件
│   │   ├── App.tsx                  # 根组件
│   │   ├── api/                     # API调用
│   │   │   ├── client.ts            # axios配置
│   │   │   └── modules/            # 分模块API
│   │   ├── components/              # 公共组件
│   │   │   ├── ui/                  # 基础UI组件
│   │   │   └── charts/              # 图表组件
│   │   ├── pages/                   # 页面
│   │   │   ├── Dashboard/           # 仪表盘
│   │   │   ├── Market/              # 行情
│   │   │   ├── Trade/               # 交易
│   │   │   ├── Backtest/            # 回测
│   │   │   └── Notes/               # 心得
│   │   ├── stores/                  # 状态管理
│   │   ├── hooks/                   # 自定义Hook
│   │   ├── types/                   # 类型定义
│   │   ├── utils/                   # 工具函数
│   │   └── mocks/                   # Mock配置
│   │       ├── browser.ts           # MSW浏览器配置
│   │       ├── node.ts              # MSW Node配置
│   │       └── handlers/            # Mock处理器
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── docs/                            # 文档
│   └── specs/                       # 设计文档
├── scripts/                          # 脚本
│   └── data-download/               # 数据下载脚本
├── .env.example
├── package.json                      # 根目录pnpm workspace配置
└── README.md
```

---

## 三、功能模块设计

### 3.1 模块总览

| 模块 | 功能 | 优先级 |
|------|------|--------|
| 行情模块 (Market) | 历史数据存储、实时行情、行情查询 | P0 |
| 账户模块 (Account) | 多账户管理、账户对比 | P1 |
| 持仓模块 (Position) | 持仓查询、持仓盈亏 | P2 |
| 交易模块 (Trade) | 买入、卖出、交易记录 | P3 |
| 策略模块 (Strategy) | 选股条件、买卖条件、仓位配置 | P4 |
| 回测模块 (Backtest) | 历史回测、参数优化 | P5 |
| 心得模块 (Note) | 交易笔记、复盘记录 | P6 |
| 通知模块 (Notification) | 价格提醒、系统通知 | P7 |
| 自选股模块 (Watchlist) | 自选股分组管理 | P8 |
| 系统设置 (Settings) | 个性化配置 | P9 |

### 3.2 行情模块 (Market)

#### 功能描述

- 全A股历史行情数据存储（**2015年至今**）
- 实时行情数据定时获取
- 多周期数据支持（日、周、月、1/5/15/30/60分钟）
- 股票基本信息查询

#### 核心接口

```
GET  /api/v1/market/stocks              # 股票列表
GET  /api/v1/market/stocks/:code        # 股票详情
GET  /api/v1/market/history/:code       # 历史行情
GET  /api/v1/market/realtime/:code      # 实时行情
GET  /api/v1/market/realtime/batch      # 批量实时行情
GET  /api/v1/market/rankings            # 涨跌幅排行
```

#### 数据模型

```prisma
model Stock {
  code      String   @id    // 股票代码
  name      String            // 股票名称
  market    String            // 市场（SH/SZ）
  industry  String?           // 行业
  listDate  DateTime?         // 上市日期

  history   HistoryData[]
  realtime  RealtimeData?
}

model HistoryData {
  id        Int      @id @default(autoincrement())
  code      String
  date      DateTime
  open      Float
  high      Float
  low       Float
  close     Float
  volume    Float
  amount    Float
  turnover  Float?    // 换手率
  adjust    String    // 复权类型（None/Forward/Backward）

  stock     Stock     @relation(fields: [code], references: [code])

  @@unique([code, date, adjust])
}

model RealtimeData {
  code        String   @id
  price       Float
  change      Float
  changePct   Float
  volume      Float
  amount      Float
  high        Float
  low         Float
  open        Float
  prevClose   Float
  bid1        Float    // 买一价
  ask1        Float    // 卖一价
  updatedAt   DateTime @updatedAt

  stock       Stock    @relation(fields: [code], references: [code])
}
```

### 3.3 账户模块 (Account)

#### 功能描述

- 创建多个独立模拟账户
- 每个账户独立资金、独立持仓
- 账户收益对比分析

#### 核心接口

```
GET    /api/v1/accounts                # 账户列表
POST   /api/v1/accounts                # 创建账户
GET    /api/v1/accounts/:id            # 账户详情
PUT    /api/v1/accounts/:id            # 更新账户
DELETE /api/v1/accounts/:id            # 删除账户
GET    /api/v1/accounts/:id/stats      # 账户统计
GET    /api/v1/accounts/compare       # 账户对比
```

#### 数据模型

```prisma
model Account {
  id          String    @id @default(uuid())
  name        String
  initialFund Decimal   @default(100000)  // 初始资金
  cash        Decimal                   // 可用资金
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  positions   Position[]
  trades      Trade[]
  stats       AccountStats?
}

model AccountStats {
  id              String   @id
  accountId       String   @unique
  totalValue      Decimal  // 总市值
  profit          Decimal  // 总盈亏
  profitPct       Float    // 收益率
  winCount        Int      // 盈利次数
  lossCount       Int      // 亏损次数
  maxDrawdown     Float    // 最大回撤
  updatedAt       DateTime @updatedAt

  account         Account  @relation(fields: [accountId], references: [id])
}
```

### 3.4 持仓模块 (Position)

#### 功能描述

- 查询账户持仓
- 计算持仓成本、盈亏
- 持仓占比分析

#### 核心接口

```
GET  /api/v1/accounts/:accountId/positions     # 持仓列表
GET  /api/v1/accounts/:accountId/positions/:code  # 单只持仓
```

#### 数据模型

```prisma
model Position {
  id          String   @id @default(uuid())
  accountId   String
  code        String
  quantity    Int      // 持股数量
  avgCost     Decimal  // 持仓成本
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  account     Account  @relation(fields: [accountId], references: [id])

  @@unique([accountId, code])
}
```

### 3.5 交易模块 (Trade)

#### 功能描述

- 模拟买入/卖出操作（**v1版本：市价单**，以当前价格成交）
- 交易记录查询
- 交易费用计算（印花税、佣金、过户费）
- **注意**：v1版本不验证交易时间段，随时可交易

#### 交易规则

| 规则 | 说明 |
|------|------|
| 订单类型 | 市价单（Market Order） |
| 成交价格 | 买入时取当前卖一价，卖出时取当前买一价 |
| 最小交易单位 | 100股（A股规则） |
| 交易时间段 | v1不验证，暂不限制 |

#### 核心接口

```
POST   /api/v1/trades                      # 执行交易
GET    /api/v1/accounts/:accountId/trades   # 交易记录
GET    /api/v1/trades/:id                  # 交易详情
```

#### 数据模型

```prisma
model Trade {
  id          String      @id @default(uuid())
  accountId   String
  code        String
  name        String
  type        TradeType   // BUY / SELL
  price       Decimal
  quantity    Int
  amount      Decimal
  fee         Decimal     // 手续费
  timestamp   DateTime    @default(now())

  account     Account     @relation(fields: [accountId], references: [id])

  @@index([accountId, timestamp])
}

enum TradeType {
  BUY
  SELL
}
```

### 3.6 策略模块 (Strategy)

#### 功能描述

- 选股条件配置（基本面、技术面、资金面）
- 买卖条件配置（止盈、止损）
- 仓位配置（单票上限、行业上限）

#### 核心接口

```
GET    /api/v1/strategies                # 策略列表
POST   /api/v1/strategies                # 创建策略
GET    /api/v1/strategies/:id           # 策略详情
PUT    /api/v1/strategies/:id           # 更新策略
DELETE /api/v1/strategies/:id           # 删除策略
```

#### 数据模型

```prisma
model Strategy {
  id          String   @id @default(uuid())
  name        String
  description String?
  config      Json     // 策略配置（选股、买卖、仓位）
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  backtests   Backtest[]
}

model StrategyConfig {
  // 选股条件
  stockSelection: {
    // 基本面
    peMin?: number
    peMax?: number
    pbMin?: number
    pbMax?: number
    marketCapMin?: number
    marketCapMax?: number

    // 技术面
    maBullish?: boolean        // 均线多头
    macdGolden?: boolean       // MACD金叉
    kdjOversold?: boolean      // KDJ超卖

    // 资金面
    capitalInflow?: 'large' | 'medium' | 'small'
  }

  // 买入条件
  buy: {
    type: 'breakout' | 'pullback' | 'maSupport' | 'close' | 'auction'
    params: Record<string, any>
    batchCount?: number        // 分批数量
  }

  // 卖出条件
  sell: {
    profitTarget?: { type: 'percentage' | 'fixed'; value: number }
    stopLoss?: { type: 'percentage' | 'fixed'; value: number }
    trailingStop?: number
    timeLimit?: number         // 持仓天数
  }

  // 仓位控制
  position: {
    maxSingleStock: number     // 单票最大仓位
    maxIndustry: number        // 行业最大仓位
    maxTotal: number          // 总仓位上限
  }
}
```

### 3.7 回测模块 (Backtest)

#### 功能描述

- 基于历史数据的策略回测
- 收益曲线、回撤分析
- 胜率、盈亏比统计

#### 核心接口

```
POST   /api/v1/backtests                    # 创建回测任务
GET    /api/v1/backtests                    # 回测列表
GET    /api/v1/backtests/:id                # 回测详情
GET    /api/v1/backtests/:id/report         # 回测报告
DELETE /api/v1/backtests/:id                # 删除回测
```

#### 数据模型

```prisma
model Backtest {
  id          String      @id @default(uuid())
  strategyId  String
  accountId   String
  startDate   DateTime
  endDate     DateTime
  status      BacktestStatus @default(PENDING)
  result      Json?
  createdAt   DateTime    @default(now())
  completedAt DateTime?

  strategy    Strategy    @relation(fields: [strategyId], references: [id])
}

enum BacktestStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

model BacktestResult {
  // 收益指标
  totalReturn: number
  annualReturn: number
  sharpeRatio: number

  // 风险指标
  maxDrawdown: number
  maxDrawdownDuration: number
  volatility: number

  // 交易统计
  totalTrades: number
  winRate: number
  profitLossRatio: number
  avgHoldingDays: number

  // 收益曲线
  equityCurve: Array<{ date: string; value: number }>

  // 交易明细
  trades: Array<{
    date: string
    code: string
    type: 'BUY' | 'SELL'
    price: number
    quantity: number
  }>
}
```

### 3.8 心得模块 (Note)

#### 功能描述

- 交易笔记记录
- 策略复盘
- 学习记录

#### 核心接口

```
GET    /api/v1/notes                           # 笔记列表
POST   /api/v1/notes                           # 创建笔记（可关联tradeId）
GET    /api/v1/notes/:id                      # 笔记详情
PUT    /api/v1/notes/:id                      # 更新笔记
DELETE /api/v1/notes/:id                      # 删除笔记
GET    /api/v1/trades/:tradeId/notes          # 获取关联交易关联的笔记
```

#### 数据模型

```prisma
model Note {
  id        String      @id @default(uuid())
  title     String
  content   String
  type      NoteType
  tags      String[]
  tradeId   String?     // 关联交易
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
}

enum NoteType {
  DAILY_REVIEW     // 每日复盘
  TRADE_REFLECTION // 交易反思
  STRATEGY_REVIEW  // 策略复盘
  LEARNING         // 学习记录
  MISC             // 其他
}
```

### 3.9 通知模块 (Notification)

#### 功能描述

- 价格提醒（涨跌幅、目标价）
- 持仓提醒（止盈止损）
- 系统通知（回测完成等）

#### 通知机制

- **v1采用轮询模式**：前端定时调用 `/api/v1/notifications` 获取最新通知
- 暂无WebSocket推送，后续可扩展

#### 核心接口

```
GET    /api/v1/notifications                 # 通知列表
POST   /api/v1/notifications                 # 创建提醒
PUT    /api/v1/notifications/:id/read        # 标记已读
DELETE /api/v1/notifications/:id             # 删除通知
```

#### 数据模型

```prisma
model Notification {
  id        String   @id @default(uuid())
  type      NotificationType
  title     String
  content   String
  data      Json?    // 附加数据
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())
}

enum NotificationType {
  PRICE_ALERT      // 价格提醒
  PROFIT_ALERT     // 止盈提醒
  LOSS_ALERT       // 止损提醒
  SYSTEM           // 系统通知
}
```

### 3.10 自选股模块 (Watchlist)

#### 功能描述

- 自选股分组管理
- 分组行情监控

#### 核心接口

```
GET    /api/v1/watchlists                    # 分组列表
POST   /api/v1/watchlists                   # 创建分组
PUT    /api/v1/watchlists/:id              # 更新分组
DELETE /api/v1/watchlists/:id              # 删除分组
POST   /api/v1/watchlists/:id/stocks       # 添加股票
DELETE /api/v1/watchlists/:id/stocks/:code // 移除股票
```

#### 数据模型

```prisma
model Watchlist {
  id        String   @id @default(uuid())
  name      String
  userId    String   @default("default")  // v1固定为"default"，预留多用户扩展
  createdAt DateTime @default(now())

  stocks    WatchlistStock[]
}

model WatchlistStock {
  watchlistId String
  stockCode  String
  sortOrder  Int      @default(0)

  watchlist  Watchlist @relation(fields: [watchlistId], references: [id])

  @@id([watchlistId, stockCode])
}
```

### 3.11 系统设置模块 (Settings)

#### 功能描述

- **主题切换**（金融风格/卡通风格/极简风格）
- 个性化设置（快捷键）
- 交易设置（手续费率、滑点）
- 数据设置（数据源、更新频率）

#### 核心接口

```
GET  /api/v1/settings              # 获取设置
PUT  /api/v1/settings             # 更新设置
```

#### 数据模型

```prisma
model Settings {
  id        String   @id @default("default")  // v1固定为"default"，预留多用户扩展

  // 界面设置
  theme     String   @default("financial")  // 主题：financial/cartoon/minimal
  shortcuts Json?

  // 交易设置
  defaultFee: {
    stampTax: number      // 印花税 (0.001)
    commission: number     // 佣金 (0.0003)
    minCommission: number  // 最低佣金 (5)
    transferFee: number    // 过户费 (0.00002)
  }
  defaultSlippage: number // 默认滑点

  // 数据设置
  dataUpdateInterval: number  // 数据更新间隔（秒）

  updatedAt DateTime @updatedAt
}
```

---

## 四、数据流程设计

### 4.1 数据采集流程

#### akshare API 使用规范

| 数据类型 | akshare接口 | 频率 | 说明 |
|----------|-------------|------|------|
| 股票列表 | `stock_info_a_code_name` | 每日一次 | 更新股票基本信息 |
| 历史日线 | `stock_zh_a_hist` | 每日收盘后 | 获取历史K线 |
| 实时行情 | `stock_zh_a_spot_em` | 每60秒 | 全A股实时行情 |

#### 数据量估算

- 全A股约5000只股票
- 日线数据（2015年至今）约11年 × 250交易日 ≈ 2750条/股
- 总历史数据量约：5000 × 2750 = 约1400万条记录
- 预计存储空间：约0.5-1GB

#### 可靠性策略

- **重试机制**：API调用失败时，指数退避重试（最多3次）
- **分批处理**：避免单次请求数据量过大
- **部分失败处理**：单只股票失败不影响其他股票
- **数据校验**：入库前校验价格合理性（>0、在合理范围内）

#### 任务调度

| 任务 | 调度时间 | 说明 |
|------|----------|------|
| 股票列表更新 | 每日 09:00 | 更新股票基本信息 |
| 历史数据补全 | 每日 16:00 | 补充前一日日线数据 |
| 实时行情轮询 | 每60秒 | 更新实时行情到Redis |



```
┌─────────────────────────────────────────────────────────┐
│                    定时任务调度                          │
│                  (node-cron 每日/定时)                   │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
┌───────────────┐          ┌───────────────┐
│  akshare API  │          │  akshare API  │
│   历史数据     │          │   实时数据     │
└───────┬───────┘          └───────┬───────┘
        │                          │
        ▼                          ▼
┌───────────────┐          ┌───────────────┐
│   数据处理     │          │   缓存更新     │
│  (清洗/校验)   │          │   (Redis)     │
└───────┬───────┘          └───────┬───────┘
        │                          │
        ▼                          ▼
┌───────────────┐          ┌───────────────┐
│   MySQL       │          │   Redis       │
│  历史数据表    │          │  实时行情缓存  │
└───────────────┘          └───────────────┘
```

### 4.2 交易流程

```
用户下单 → 验证资金 → 扣减现金 → 创建持仓/更新持仓 → 记录交易 → 更新账户
```

### 4.3 回测流程

```
配置策略 → 选择时间范围 → 获取历史数据 → 按时间序列回放 → 生成交易信号
     ↓
执行模拟交易 → 计算收益 → 统计指标 → 生成报告
```

---

## 五、前端页面设计

### 5.1 页面结构

```
/                           # 首页/仪表盘
├── /market                 # 行情页面
│   ├── /market/list        # 股票列表
│   ├── /market/stock/:code # 个股详情
│   └── /market/rankings    # 涨跌幅排行
├── /trade                  # 交易页面
│   ├── /trade/account      # 账户管理
│   ├── /trade/positions    # 持仓查询
│   ├── /trade/orders      # 交易下单
│   └── /trade/history     # 交易记录
├── /backtest              # 回测页面
│   ├── /backtest/new      # 新建回测
│   ├── /backtest/list     # 回测列表
│   └── /backtest/:id      # 回测详情
├── /notes                 # 心得页面
│   ├── /notes/list        # 笔记列表
│   └── /notes/:id         # 笔记详情
└── /settings             # 设置页面
```

### 5.2 核心页面

#### 主题系统

支持多套独立主题，每套主题包含完整的配色方案、字体、圆角、阴影等样式定义。

**主题类型：**

| 主题 | 风格描述 | 适用场景 |
|------|----------|----------|
| **金融风格（默认）** | 深色背景、专业配色、红涨绿跌 | 专业交易、数据密集 |
| **卡通风格** | 像素风、马里奥风格、马赛克设计 | 游戏感、怀旧、轻松有趣 |
| **极简风格** | 纯白/纯黑、极致简洁、无多余装饰 | 专注内容、高效操作 |

**主题配置示例：**

```typescript
// 金融风格（默认）
const financialTheme = {
  colors: {
    primary: '#3B82F6',      // 主色：蓝色
    secondary: '#6366F1',    // 辅色：靛蓝
    background: '#0F172A',    // 背景：深蓝黑
    surface: '#1E293B',       // 卡片：深灰蓝
    text: '#F1F5F9',         // 文本：浅灰白
    up: '#EF4444',           // 涨：红色
    down: '#22C55E',         // 跌：绿色
  },
  borderRadius: '0.375rem',
  shadows: 'sm',
}

// 卡通风格（像素风/马里奥）
const cartoonTheme = {
  colors: {
    primary: '#FFD700',       // 主色：金币黄
    secondary: '#FF6B6B',    // 辅色：红蘑菇
    background: '#87CEEB',   // 背景：天空蓝
    surface: '#FFFFFF',       // 卡片：白色
    text: '#2D3436',         // 文本：深灰
    up: '#FF4757',           // 涨：红色（涨旗）
    down: '#2ECC71',         // 跌：绿色（草地）
    accent: '#9B59B6',       // 强调色：紫色星星
    warning: '#E67E22',       // 警告色：橙色火焰
  },
  borderRadius: '0',          // 无圆角（像素风格）
  shadows: 'none',           // 无阴影（像素感）
  fontFamily: 'monospace',   // 等宽字体
}

// 极简风格
const minimalTheme = {
  colors: {
    primary: '#000000',       // 主色：纯黑
    secondary: '#6B7280',    // 辅色：灰
    background: '#FFFFFF',    // 背景：纯白
    surface: '#FAFAFA',       // 卡片：极浅灰
    text: '#000000',         // 文本：黑色
    up: '#000000',           // 涨：黑色
    down: '#9CA3AF',         // 跌：浅灰
  },
  borderRadius: '0',          // 无圆角
  shadows: 'none',           // 无阴影
}
```

**技术实现：**

- 使用 CSS Variables 存储主题变量
- TailwindCSS 配置支持主题切换
- React Context 管理当前主题状态
- 主题偏好保存到 localStorage

**主题切换交互：**
- 设置页面提供主题选择器
- 支持实时预览切换效果
- 切换动画过渡

#### 仪表盘
- 账户概览（总资产、盈亏）
- 持仓概览（持仓数、盈亏）
- 今日行情（涨跌幅排行）
- 快捷操作入口

#### 行情页面
- 股票搜索与筛选
- 股票列表（代码、名称、现价、涨跌幅）
- K线图（支持多周期切换）
- 分时图
- 基本面信息

#### 交易页面
- 账户列表与切换
- 持仓列表
- 交易下单面板
- 交易历史记录

#### 回测页面
- 策略配置器
- 回测参数设置
- 回测结果展示（收益曲线、回撤图）
- 回测报告下载

---

## 六、开发计划

### 第一阶段：基础设施
1. 项目脚手架搭建（NestJS + React）
2. Docker环境配置（MySQL + Redis）
3. 数据库设计与Prisma配置
4. 基础API框架（增删改查模板）

### 第二阶段：行情数据（最高优先级）
5. akshare数据采集服务
6. 历史数据存储与查询（Market模块）
7. 实时行情轮询服务（定时任务）

### 第三阶段：账户与持仓
8. 账户管理模块（Account模块）
9. 持仓管理模块（Position模块）
10. 交易执行模块（Trade模块）

### 第四阶段：策略与回测
11. 策略配置模块（Strategy模块）
12. 回测引擎（Backtest模块）

### 第五阶段：辅助功能
13. 账户对比（收益分析）
14. 交易心得模块（Note模块）

### 第六阶段：增强功能
15. 通知提醒模块（Notification模块）
16. 自选股模块（Watchlist模块）
17. 系统设置模块（Settings模块）

---

## 七、部署方案

### 7.1 开发环境

```yaml
# docker-compose.yml
services:
  mysql:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: trade_system
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  mysql_data:
```

### 7.2 启动命令

```bash
# 安装依赖
pnpm install

# 启动开发环境
docker-compose up -d

# 启动后端
cd server && pnpm start:dev

# 启动前端
cd web && pnpm dev
```

---

## 八、风险与注意事项

### 8.1 数据风险
- akshare是第三方免费接口，存在接口变更风险
- 数据完整性需要定期校验
- 历史数据量较大，需要定期归档

### 8.2 性能风险
- 全A股实时数据量大，需要合理的缓存策略
- 回测计算密集，需要考虑性能优化
- 前端K线图渲染需要优化

### 8.3 未来扩展
- 支持更多数据源（东方财富、通达信等）
- 精细回测（分时级别）
- 实盘对接（可选）

---

## 九、附录

### 9.1 API响应格式

```typescript
// 成功响应
{
  "code": 0,
  "message": "success",
  "data": { ... }
}

// 错误响应
{
  "code": 1001,
  "message": "错误描述",
  "data": null
}
```

### 9.2 错误码定义

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| 1001 | 参数错误 |
| 1002 | 资源不存在 |
| 2001 | 余额不足 |
| 2002 | 持仓不足 |
| 3001 | 回测执行失败 |
| 5001 | 服务器内部错误 |

### 9.3 HTTP状态码规范

| 状态码 | 含义 | 使用场景 |
|--------|------|----------|
| 200 | OK | 成功响应 |
| 201 | Created | 资源创建成功 |
| 400 | Bad Request | 参数错误、业务校验失败 |
| 404 | Not Found | 资源不存在 |
| 500 | Internal Server Error | 服务器内部错误 |

### 9.4 错误处理策略

- **NestJS全局异常过滤器**：统一处理未捕获异常
- **业务异常**：使用自定义异常类（如 `BalanceNotEnoughException`）
- **数据库事务**：交易操作使用事务保证一致性
- **前端错误展示**：统一错误提示组件，根据错误码显示友好信息

### 9.5 参考资料

- [NestJS 文档](https://docs.nestjs.com)
- [Prisma 文档](https://prisma.io/docs)
- [MSW 文档](https://mswjs.io)
- [akshare 文档](https://akshare.akfamily.xyz)
