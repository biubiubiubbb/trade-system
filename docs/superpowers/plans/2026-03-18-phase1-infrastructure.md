# A股交易系统 - 基础设施搭建计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建完整的项目脚手架，包括后端 NestJS、前端 React、项目结构、Docker环境

**Architecture:**
- Monorepo结构（pnpm workspace）
- 后端：NestJS + Prisma + MySQL + Redis
- 前端：React + TypeScript + Vite + TailwindCSS
- 开发环境：Docker Compose

**Tech Stack:** NestJS 10, React 18, Prisma 5, MySQL 8, Redis 7, Vite 5, TailwindCSS 3

---

## 文件结构

```
trade-system/
├── server/                          # 后端项目
│   ├── src/
│   │   ├── main.ts                 # 入口
│   │   ├── app.module.ts           # 根模块
│   │   ├── common/                 # 公共模块
│   │   │   ├── filters/            # 全局异常过滤器
│   │   │   ├── interceptors/       # 响应拦截器
│   │   │   └── utils/              # 工具函数
│   │   └── database/               # 数据库配置
│   ├── prisma/
│   │   └── schema.prisma           # 数据模型
│   ├── test/                       # 测试
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── package.json
├── web/                            # 前端项目
│   ├── src/
│   │   ├── main.tsx                # 入口
│   │   ├── App.tsx                 # 根组件
│   │   ├── api/                    # API调用
│   │   ├── components/             # 公共组件
│   │   ├── pages/                  # 页面
│   │   ├── stores/                 # 状态管理
│   │   ├── mocks/                  # MSW配置
│   │   └── types/                  # 类型定义
│   ├── public/
│   ├── vite.config.ts
│   └── package.json
├── package.json                     # pnpm workspace根配置
├── .env.example
└── docs/superpowers/plans/         # 计划文档
```

---

## Task 1: 初始化后端项目

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/nest-cli.json`
- Create: `server/src/main.ts`
- Create: `server/src/app.module.ts`
- Create: `server/.gitignore`

- [ ] **Step 1: 创建 server/package.json**

```json
{
  "name": "@trade-system/server",
  "version": "1.0.0",
  "description": "A-Stock Trading System Backend",
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/platform-express": "^10.3.0",
    "@nestjs/swagger": "^7.2.0",
    "@nestjs/config": "^3.1.1",
    "@nestjs/schedule": "^4.0.0",
    "@prisma/client": "^5.8.0",
    "axios": "^1.6.5",
    "class-validator": "^0.14.1",
    "class-transformer": "^0.5.1",
    "reflect-metadata": "^0.2.1",
    "rxjs": "^7.8.1",
    "ioredis": "^5.3.2"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.0",
    "@nestjs/schematics": "^10.1.0",
    "@nestjs/testing": "^10.3.0",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.11",
    "@types/node": "^20.10.6",
    "@typescript-eslint/eslint-plugin": "^6.17.0",
    "@typescript-eslint/parser": "^6.17.0",
    "eslint": "^8.56.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-prettier": "^5.1.2",
    "jest": "^29.7.0",
    "prettier": "^3.1.1",
    "prisma": "^5.8.0",
    "source-map-support": "^0.5.21",
    "ts-jest": "^29.1.1",
    "ts-loader": "^9.5.1",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.3.3"
  }
}
```

- [ ] **Step 2: 创建 server/tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

- [ ] **Step 3: 创建 server/nest-cli.json**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "assets": ["**/*.prisma"],
    "watchAssets": true
  }
}
```

- [ ] **Step 4: 创建 server/src/main.ts**

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 全局前缀
  app.setGlobalPrefix('api/v1');

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors();

  // Swagger文档
  const config = new DocumentBuilder()
    .setTitle('A-Stock Trading System API')
    .setDescription('A股交易系统API文档')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
```

- [ ] **Step 5: 创建 server/src/app.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 6: 创建 server/.gitignore**

```
node_modules/
dist/
.env
*.log
.DS_Store
coverage/
```

- [ ] **Step 7: 安装依赖**

```bash
cd server && pnpm install
```

- [ ] **Step 8: 提交**

```bash
cd server
git init 2>/dev/null || true
git add package.json tsconfig.json nest-cli.json src .gitignore
git commit -m "feat: 初始化后端项目基础结构"
```

---

## Task 2: 配置 Prisma 和数据库

**Files:**
- Create: `server/prisma/schema.prisma`
- Create: `server/src/database/database.module.ts`
- Create: `server/src/database/prisma.service.ts`
- Create: `server/.env.example`

- [ ] **Step 1: 创建 server/prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// 股票基本信息
model Stock {
  code      String   @id
  name      String
  market    String   // SH/SZ
  industry  String?
  listDate  DateTime?

  history   HistoryData[]
  realtime  RealtimeData?

  @@index([name])
  @@index([industry])
}

// 历史行情数据
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
  turnover  Float?
  adjust    String   @default("None") // None/Forward/Backward

  stock     Stock    @relation(fields: [code], references: [code])

  @@unique([code, date, adjust])
  @@index([code, date])
}

// 实时行情数据
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
  bid1        Float
  ask1        Float
  updatedAt   DateTime @updatedAt

  stock       Stock    @relation(fields: [code], references: [code])
}

// 账户
model Account {
  id          String    @id @default(uuid())
  name        String
  initialFund Decimal   @db.Decimal(18, 2) @default(100000)
  cash        Decimal   @db.Decimal(18, 2)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  positions   Position[]
  trades      Trade[]
  stats       AccountStats?

  @@index([name])
}

// 账户统计
model AccountStats {
  id              String   @id @default(uuid())
  accountId       String   @unique
  totalValue     Decimal  @db.Decimal(18, 2)
  profit          Decimal  @db.Decimal(18, 2)
  profitPct      Float
  winCount        Int      @default(0)
  lossCount       Int      @default(0)
  maxDrawdown     Float    @default(0)
  updatedAt       DateTime @updatedAt

  account         Account  @relation(fields: [accountId], references: [id])
}

// 持仓
model Position {
  id          String   @id @default(uuid())
  accountId   String
  code        String
  name        String
  quantity    Int
  avgCost     Decimal  @db.Decimal(18, 4)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  account     Account  @relation(fields: [accountId], references: [id])

  @@unique([accountId, code])
  @@index([accountId])
}

// 交易记录
model Trade {
  id          String      @id @default(uuid())
  accountId   String
  code        String
  name        String
  type        TradeType
  price       Decimal     @db.Decimal(18, 4)
  quantity    Int
  amount      Decimal     @db.Decimal(18, 2)
  fee         Decimal     @db.Decimal(18, 2)
  timestamp   DateTime    @default(now())

  account     Account     @relation(fields: [accountId], references: [id])

  @@index([accountId, timestamp])
  @@index([accountId])
}

enum TradeType {
  BUY
  SELL
}

// 策略
model Strategy {
  id          String   @id @default(uuid())
  name        String
  description String?
  config      Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  backtests   Backtest[]
}

// 回测任务
model Backtest {
  id          String         @id @default(uuid())
  strategyId  String
  accountId   String
  startDate   DateTime
  endDate     DateTime
  status      BacktestStatus @default(PENDING)
  result      Json?
  createdAt   DateTime       @default(now())
  completedAt DateTime?

  strategy    Strategy       @relation(fields: [strategyId], references: [id])
}

enum BacktestStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

// 交易笔记
model Note {
  id        String   @id @default(uuid())
  title     String
  content   String   @db.Text
  type      NoteType
  tags      String[]
  tradeId   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum NoteType {
  DAILY_REVIEW
  TRADE_REFLECTION
  STRATEGY_REVIEW
  LEARNING
  MISC
}

// 通知
model Notification {
  id        String           @id @default(uuid())
  type      NotificationType
  title     String
  content   String
  data      Json?
  isRead    Boolean         @default(false)
  createdAt DateTime        @default(now())
}

enum NotificationType {
  PRICE_ALERT
  PROFIT_ALERT
  LOSS_ALERT
  SYSTEM
}

// 自选股
model Watchlist {
  id        String           @id @default(uuid())
  name      String
  userId    String          @default("default")
  createdAt DateTime        @default(now())

  stocks    WatchlistStock[]
}

model WatchlistStock {
  watchlistId String
  stockCode  String
  sortOrder  Int      @default(0)

  watchlist  Watchlist @relation(fields: [watchlistId], references: [id], onDelete: Cascade)

  @@id([watchlistId, stockCode])
}

// 系统设置
model Settings {
  id                 String   @id @default("default")
  theme              String   @default("light")
  shortcuts          Json?
  stampTax           Float    @default(0.001)
  commission         Float    @default(0.0003)
  minCommission      Float    @default(5)
  transferFee        Float    @default(0.00002)
  defaultSlippage    Float    @default(0)
  dataUpdateInterval Int      @default(60)
  updatedAt          DateTime @updatedAt
}
```

- [ ] **Step 2: 创建 server/src/database/prisma.service.ts**

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 3: 创建 server/src/database/database.module.ts**

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
```

- [ ] **Step 4: 创建 server/.env.example**

```
# 数据库
DATABASE_URL="mysql://root:rootpassword@localhost:3306/trade_system"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# 应用
PORT=3000
NODE_ENV=development

# akshare
AKSHARE_API_DELAY=1000
```

- [ ] **Step 5: 生成 Prisma Client**

```bash
cd server && pnpm prisma:generate
```

- [ ] **Step 6: 提交**

```bash
git add prisma/schema.prisma src/database/
git commit -m "feat: 配置Prisma和数据模型"
```

---

## Task 3: 配置 Docker 开发环境

**Files:**
- Create: `server/docker-compose.yml`
- Create: `server/Dockerfile`

- [ ] **Step 1: 创建 server/docker-compose.yml**

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8
    container_name: trade_system_mysql
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: trade_system
      TZ: Asia/Shanghai
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    command: --default-authentication-plugin=mysql_native_password

  redis:
    image: redis:7-alpine
    container_name: trade_system_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  mysql_data:
  redis_data:
```

- [ ] **Step 2: 创建 server/Dockerfile**

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm prisma:generate
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install -g pnpm && pnpm install --production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

EXPOSE 3000
CMD ["node", "dist/main"]
```

- [ ] **Step 3: 启动 Docker 环境**

```bash
cd server && docker-compose up -d
```

- [ ] **Step 4: 运行数据库迁移**

```bash
cd server && pnpm prisma:migrate dev --name init
```

- [ ] **Step 5: 提交**

```bash
git add docker-compose.yml Dockerfile
git commit -m "feat: 添加Docker开发环境配置"
```

---

## Task 4: 初始化前端项目

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/vite.config.ts`
- Create: `web/index.html`
- Create: `web/src/main.tsx`
- Create: `web/src/App.tsx`
- Create: `web/tailwind.config.js`
- Create: `web/postcss.config.js`
- Create: `web/.gitignore`

- [ ] **Step 1: 创建 web/package.json**

```json
{
  "name": "@trade-system/web",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --fix",
    "test": "vitest"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.1",
    "zustand": "^4.4.7",
    "axios": "^1.6.5",
    "echarts": "^5.4.3",
    "echarts-for-react": "^3.0.2",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "date-fns": "^3.0.6",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-tooltip": "^1.0.7"
  },
  "devDependencies": {
    "@types/react": "^18.2.47",
    "@types/react-dom": "^18.2.18",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.33",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.11",
    "vitest": "^1.2.1",
    "msw": "^2.0.13",
    "@faker-js/faker": "^8.3.1"
  }
}
```

- [ ] **Step 2: 创建 web/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: 创建 web/tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: 创建 web/vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 5: 创建 web/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>A股交易系统</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: 创建 web/src/main.tsx**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

- [ ] **Step 7: 创建 web/src/App.tsx**

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Market } from './pages/Market';
import { Trade } from './pages/Trade';
import { Backtest } from './pages/Backtest';
import { Notes } from './pages/Notes';
import { Settings } from './pages/Settings';
import { Layout } from './components/Layout';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="market" element={<Market />} />
        <Route path="trade" element={<Trade />} />
        <Route path="backtest" element={<Backtest />} />
        <Route path="notes" element={<Notes />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
```

- [ ] **Step 8: 创建 web/src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

body {
  @apply bg-gray-50 text-gray-900;
}
```

- [ ] **Step 9: 创建 web/tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        up: '#ef4444',
        down: '#22c55e',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 10: 创建 web/postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 11: 创建 web/.gitignore**

```
node_modules/
dist/
.env
*.local
coverage/
```

- [ ] **Step 12: 创建基础页面占位**

```tsx
// web/src/pages/Dashboard.tsx
export function Dashboard() {
  return <div className="p-6">仪表盘</div>;
}

// web/src/pages/Market.tsx
export function Market() {
  return <div className="p-6">行情</div>;
}

// web/src/pages/Trade.tsx
export function Trade() {
  return <div className="p-6">交易</div>;
}

// web/src/pages/Backtest.tsx
export function Backtest() {
  return <div className="p-6">回测</div>;
}

// web/src/pages/Notes.tsx
export function Notes() {
  return <div className="p-6">心得</div>;
}

// web/src/pages/Settings.tsx
export function Settings() {
  return <div className="p-6">设置</div>;
}
```

- [ ] **Step 13: 创建 Layout 组件**

```tsx
// web/src/components/Layout.tsx
import { Outlet, Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', label: '仪表盘' },
  { path: '/market', label: '行情' },
  { path: '/trade', label: '交易' },
  { path: '/backtest', label: '回测' },
  { path: '/notes', label: '心得' },
  { path: '/settings', label: '设置' },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex">
      <aside className="w-48 bg-gray-900 text-white p-4">
        <h1 className="text-lg font-bold mb-6">A股交易系统</h1>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-3 py-2 rounded ${
                location.pathname === item.path
                  ? 'bg-primary-600'
                  : 'hover:bg-gray-800'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 14: 安装依赖**

```bash
cd web && pnpm install
```

- [ ] **Step 15: 提交**

```bash
git add web/
git commit -m "feat: 初始化前端项目基础结构"
```

---

## Task 5: 配置多主题系统

**Files:**
- Create: `web/src/theme/theme.config.ts`
- Create: `web/src/theme/ThemeContext.tsx`
- Create: `web/src/theme/themes/financial.css`
- Create: `web/src/theme/themes/cartoon.css`
- Create: `web/src/theme/themes/minimal.css`
- Create: `web/src/theme/useTheme.ts`
- Modify: `web/src/App.tsx`
- Modify: `web/src/pages/Settings.tsx`

- [ ] **Step 1: 创建主题配置文件**

```typescript
// web/src/theme/theme.config.ts

export type ThemeType = 'financial' | 'cartoon' | 'minimal';

export interface Theme {
  id: ThemeType;
  name: string;
  description: string;
}

export const themes: Theme[] = [
  { id: 'financial', name: '金融风格', description: '专业深色，适合交易' },
  { id: 'cartoon', name: '卡通风格', description: '柔和浅色，圆角设计' },
  { id: 'minimal', name: '极简风格', description: '极致简洁，无装饰' },
];

export const themeColors: Record<ThemeType, {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  up: string;
  down: string;
}> = {
  financial: {
    primary: '#3B82F6',
    secondary: '#6366F1',
    background: '#0F172A',
    surface: '#1E293B',
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    border: '#334155',
    up: '#EF4444',
    down: '#22C55E',
  },
  cartoon: {
    primary: '#FFD700',       // 金币黄
    secondary: '#FF6B6B',     // 红蘑菇
    background: '#87CEEB',   // 天空蓝
    surface: '#FFFFFF',
    text: '#2D3436',
    textSecondary: '#636E72',
    border: '#B2BEC3',
    up: '#FF4757',           // 涨旗红
    down: '#2ECC71',         // 草地绿
  },
  minimal: {
    primary: '#000000',
    secondary: '#6B7280',
    background: '#FFFFFF',
    surface: '#FAFAFA',
    text: '#000000',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
    up: '#000000',
    down: '#9CA3AF',
  },
};
```

- [ ] **Step 2: 创建主题 Context**

```tsx
// web/src/theme/ThemeContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeType, themeColors } from './theme.config';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  colors: typeof themeColors.financial;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as ThemeType) || 'financial';
  });

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  useEffect(() => {
    // 移除旧主题类名，添加新主题类名
    document.documentElement.classList.remove('theme-financial', 'theme-cartoon', 'theme-minimal');
    document.documentElement.classList.add(`theme-${theme}`);

    // 设置 CSS 变量
    const colors = themeColors[theme];
    Object.entries(colors).forEach(([key, value]) => {
      document.documentElement.style.setProperty(`--color-${key}`, value);
    });
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colors: themeColors[theme] }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
```

- [ ] **Step 3: 创建主题 CSS 文件**

```css
/* web/src/theme/themes/financial.css */
:root,
.theme-financial {
  --color-primary: #3B82F6;
  --color-secondary: #6366F1;
  --color-background: #0F172A;
  --color-surface: #1E293B;
  --color-text: #F1F5F9;
  --color-text-secondary: #94A3B8;
  --color-border: #334155;
  --color-up: #EF4444;
  --color-down: #22C55E;
  --radius: 0.375rem;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
```

```css
/* web/src/theme/themes/cartoon.css - 像素风/马里奥 */
.theme-cartoon {
  --color-primary: #FFD700;       /* 金币黄 */
  --color-secondary: #FF6B6B;    /* 红蘑菇 */
  --color-background: #87CEEB;    /* 天空蓝 */
  --color-surface: #FFFFFF;
  --color-text: #2D3436;
  --color-text-secondary: #636E72;
  --color-border: #B2BEC3;
  --color-up: #FF4757;           /* 涨旗红 */
  --color-down: #2ECC71;          /* 草地绿 */
  --radius: 0;                    /* 像素风无圆角 */
  --shadow: none;                  /* 像素风无阴影 */
  font-family: 'Courier New', monospace; /* 等宽像素字体 */
}
```

```css
/* web/src/theme/themes/minimal.css */
.theme-minimal {
  --color-primary: #000000;
  --color-secondary: #6B7280;
  --color-background: #FFFFFF;
  --color-surface: #FAFAFA;
  --color-text: #000000;
  --color-text-secondary: #6B7280;
  --color-border: #E5E7EB;
  --color-up: #000000;
  --color-down: #9CA3AF;
  --radius: 0;
  --shadow: none;
}
```

- [ ] **Step 4: 更新 index.css 使用 CSS 变量**

```css
/* web/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* 引入主题 */
@import './theme/themes/financial.css';
@import './theme/themes/cartoon.css';
@import './theme/themes/minimal.css';

:root {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  transition: background-color 0.3s, color 0.3s;
}

body {
  background-color: var(--color-background);
  color: var(--color-text);
  min-height: 100vh;
}

/* 通用组件样式 */
.card {
  background-color: var(--color-surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  border: 1px solid var(--color-border);
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: var(--radius);
  transition: opacity 0.2s;
}

.btn-primary:hover {
  opacity: 0.9;
}

.text-up {
  color: var(--color-up);
}

.text-down {
  color: var(--color-down);
}
```

- [ ] **Step 5: 更新 App.tsx 添加 ThemeProvider**

```tsx
// web/src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeContext';
import { Dashboard } from './pages/Dashboard';
import { Market } from './pages/Market';
import { Trade } from './pages/Trade';
import { Backtest } from './pages/Backtest';
import { Notes } from './pages/Notes';
import { Settings } from './pages/Settings';
import { Layout } from './components/Layout';

function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="market" element={<Market />} />
          <Route path="trade" element={<Trade />} />
          <Route path="backtest" element={<Backtest />} />
          <Route path="notes" element={<Notes />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ThemeProvider>
  );
}

export default App;
```

- [ ] **Step 6: 更新 Settings 页面添加主题切换器**

```tsx
// web/src/pages/Settings.tsx
import { useTheme } from '../theme/ThemeContext';
import { themes } from '../theme/theme.config';

export function Settings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">设置</h1>

      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">主题设置</h2>
        <div className="grid grid-cols-3 gap-4">
          {themes.map((t) => (
            <div
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                theme === t.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              style={{
                borderRadius: t.id === 'cartoon' ? '0' : t.id === 'minimal' ? '0' : '0.5rem', // 像素风无圆角
              }}
            >
              {/* 主题预览 */}
              <div
                className="h-20 mb-3"
                style={{
                  background: t.id === 'financial'
                    ? '#0F172A'
                    : t.id === 'cartoon'
                    ? '#87CEEB'  // 天空蓝
                    : '#FFFFFF',
                  border: t.id === 'financial'
                    ? '2px solid #334155'
                    : t.id === 'cartoon'
                    ? '2px solid #2D3436'  // 像素风边框
                    : '1px solid #E5E7EB',
                }}
              >
                <div className="flex gap-1 p-2">
                  {themes.map((pt) => (
                    <div
                      key={pt.id}
                      className="w-8 h-8"
                      style={{
                        background: pt.id === 'financial'
                          ? '#1E293B'
                          : pt.id === 'cartoon'
                          ? '#FFFFFF'
                          : '#FAFAFA',
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="font-medium">{t.name}</div>
              <div className="text-sm opacity-60">{t.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 其他设置... */}
    </div>
  );
}
```

- [ ] **Step 7: 更新 Layout 组件适应主题**

```tsx
// web/src/components/Layout.tsx
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTheme } from '../theme/ThemeContext';

const navItems = [
  { path: '/', label: '仪表盘' },
  { path: '/market', label: '行情' },
  { path: '/trade', label: '交易' },
  { path: '/backtest', label: '回测' },
  { path: '/notes', label: '心得' },
  { path: '/settings', label: '设置' },
];

export function Layout() {
  const location = useLocation();
  const { theme } = useTheme();

  return (
    <div className="min-h-screen flex">
      <aside
        className="w-48 p-4"
        style={{
          backgroundColor: theme === 'financial' ? '#1E293B' : theme === 'cartoon' ? '#F5F5FF' : '#FAFAFA',
          borderRight: theme === 'financial' ? '1px solid #334155' : theme === 'cartoon' ? '1px solid #E9D5FF' : '1px solid #E5E7EB',
        }}
      >
        <h1
          className="text-lg font-bold mb-6"
          style={{ color: theme === 'financial' ? '#F1F5F9' : theme === 'cartoon' ? '#4C1D95' : '#000000' }}
        >
          A股交易系统
        </h1>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="block px-3 py-2 rounded transition-colors"
              style={{
                backgroundColor: location.pathname === item.path ? 'var(--color-primary)' : 'transparent',
                color: location.pathname === item.path
                  ? 'white'
                  : theme === 'financial'
                  ? '#94A3B8'
                  : theme === 'cartoon'
                  ? '#7C3AED'
                  : '#6B7280',
                borderRadius: 'var(--radius)',
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 8: 提交**

```bash
git add web/src/theme/
git commit -m "feat: 添加多主题系统（金融/卡通/极简）"
```

---

## Task 6: 配置 MSW Mock 环境

**Files:**
- Create: `web/src/mocks/browser.ts`
- Create: `web/src/mocks/node.ts`
- Create: `web/src/mocks/handlers/index.ts`
- Create: `web/src/mocks/handlers/market.ts`
- Create: `web/src/mocks/handlers/account.ts`
- Create: `web/src/mocks/data/stocks.ts`
- Modify: `web/src/main.tsx`

- [ ] **Step 1: 安装 MSW**

```bash
cd web && pnpm add msw@2 @faker-js/faker -D
pnpm msw init web/public --save
```

- [ ] **Step 2: 创建 Mock 数据**

```typescript
// web/src/mocks/data/stocks.ts
import { faker } from '@faker-js/faker';

faker.seed(12345);

export const mockStocks = Array.from({ length: 100 }, (_, i) => ({
  code: `${i < 50 ? '600' : '000'}${String(i + 1).padStart(3, '0')}`,
  name: faker.company.name() + (i < 50 ? 'A' : 'B'),
  market: i < 50 ? 'SH' : 'SZ',
  industry: faker.helpers.arrayElement(['科技', '金融', '消费', '医药', '工业']),
  listDate: faker.date.past({ years: 10 }),
}));

export const mockHistoryData = (code: string) =>
  Array.from({ length: 100 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (99 - i));
    const open = faker.number.float({ min: 10, max: 100, fractionDigits: 2 });
    const close = open + faker.number.float({ min: -5, max: 5, fractionDigits: 2 });
    return {
      code,
      date: date.toISOString().split('T')[0],
      open,
      high: Math.max(open, close) + faker.number.float({ min: 0, max: 2, fractionDigits: 2 }),
      low: Math.min(open, close) - faker.number.float({ min: 0, max: 2, fractionDigits: 2 }),
      close,
      volume: faker.number.float({ min: 1000000, max: 100000000 }),
      amount: faker.number.float({ min: 10000000, max: 1000000000 }),
      turnover: faker.number.float({ min: 0.1, max: 20, fractionDigits: 2 }),
      adjust: 'None',
    };
  });
```

- [ ] **Step 3: 创建 Market Mock Handlers**

```typescript
// web/src/mocks/handlers/market.ts
import { http, HttpResponse } from 'msw';
import { mockStocks, mockHistoryData } from '../data/stocks';

export const marketHandlers = [
  // 股票列表
  http.get('/api/v1/market/stocks', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: mockStocks,
    });
  }),

  // 股票详情
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
      data: stock,
    });
  }),

  // 历史行情
  http.get('/api/v1/market/history/:code', ({ params }) => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: mockHistoryData(params.code as string),
    });
  }),

  // 实时行情
  http.get('/api/v1/market/realtime/:code', ({ params }) => {
    const stock = mockStocks.find((s) => s.code === params.code);
    const basePrice = 50;
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        code: params.code,
        name: stock?.name || 'Unknown',
        price: basePrice + Math.random() * 10,
        change: (Math.random() - 0.5) * 5,
        changePct: (Math.random() - 0.5) * 10,
        volume: Math.random() * 100000000,
        amount: Math.random() * 1000000000,
        high: basePrice + Math.random() * 15,
        low: basePrice - Math.random() * 5,
        open: basePrice + Math.random() * 3,
        prevClose: basePrice,
        bid1: basePrice - 0.01,
        ask1: basePrice + 0.01,
        updatedAt: new Date().toISOString(),
      },
    });
  }),
];
```

- [ ] **Step 4: 创建 Account Mock Handlers**

```typescript
// web/src/mocks/handlers/account.ts
import { http, HttpResponse } from 'msw';
import { faker } from '@faker-js/faker';

const mockAccounts = [
  {
    id: 'acc-001',
    name: '主账户',
    initialFund: 100000,
    cash: 85000,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'acc-002',
    name: '激进账户',
    initialFund: 50000,
    cash: 42000,
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
];

export const accountHandlers = [
  http.get('/api/v1/accounts', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: mockAccounts,
    });
  }),

  http.post('/api/v1/accounts', async ({ request }) => {
    const body = await request.json() as { name: string; initialFund: number };
    const newAccount = {
      id: faker.string.uuid(),
      name: body.name,
      initialFund: body.initialFund,
      cash: body.initialFund,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockAccounts.push(newAccount);
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: newAccount,
    });
  }),

  http.get('/api/v1/accounts/:id', ({ params }) => {
    const account = mockAccounts.find((a) => a.id === params.id);
    if (!account) {
      return HttpResponse.json(
        { code: 1002, message: 'Account not found', data: null },
        { status: 404 },
      );
    }
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: account,
    });
  }),
];
```

- [ ] **Step 5: 创建 Handler 导出**

```typescript
// web/src/mocks/handlers/index.ts
import { marketHandlers } from './market';
import { accountHandlers } from './account';

export const handlers = [...marketHandlers, ...accountHandlers];
```

- [ ] **Step 6: 创建 Browser Mock 配置**

```typescript
// web/src/mocks/browser.ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
```

- [ ] **Step 7: 更新 main.tsx**

```tsx
// web/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

async function enableMocking() {
  if (process.env.NODE_ENV === 'development') {
    const { worker } = await import('./mocks/browser');
    return worker.start({
      onUnhandledRequest: 'bypass',
    });
  }
}

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
});
```

- [ ] **Step 8: 提交**

```bash
git add web/src/mocks/
git commit -m "feat: 配置MSW Mock环境"
```

---

## Task 7: 配置 pnpm Workspace

**Files:**
- Create: `package.json` (根目录)
- Modify: `server/package.json`
- Modify: `web/package.json`

- [ ] **Step 1: 创建根目录 package.json**

```json
{
  "name": "trade-system",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "dev:server": "pnpm --filter @trade-system/server dev",
    "dev:web": "pnpm --filter @trade-system/web dev",
    "docker:up": "cd server && docker-compose up -d",
    "docker:down": "cd server && docker-compose down"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
```

- [ ] **Step 2: 更新 server/package.json 添加 workspace 依赖**

```json
{
  "name": "@trade-system/server"
}
```

- [ ] **Step 3: 更新 web/package.json 添加 workspace 依赖**

```json
{
  "name": "@trade-system/web"
}
```

- [ ] **Step 4: 提交**

```bash
git add package.json
git commit -m "feat: 配置pnpm workspace"
```

---

## Task 8: 验证环境

- [ ] **Step 1: 启动后端开发服务器**

```bash
cd server && pnpm start:dev
```

期望输出：
```
[Nest] 12345  - development  Application is running on: http://localhost:3000
```

- [ ] **Step 2: 启动前端开发服务器**

```bash
cd web && pnpm dev
```

期望输出：
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

- [ ] **Step 3: 访问 Swagger 文档**

打开浏览器访问：http://localhost:3000/docs

- [ ] **Step 4: 访问前端页面**

打开浏览器访问：http://localhost:5173

- [ ] **Step 5: 提交最终版本**

```bash
git add -A
git commit -m "feat: 完成基础设施搭建"
```

---

## 验证检查清单

完成所有任务后，确认：

- [ ] `docker-compose up -d` 成功启动 MySQL 和 Redis
- [ ] `pnpm start:dev` 后端正常运行，Swagger 可访问
- [ ] `pnpm dev` 前端正常运行，页面可访问
- [ ] MSW Mock 正常工作，数据可以正常显示
- [ ] **多主题切换正常工作**（金融/卡通/极简三种主题）
- [ ] **主题偏好已保存到 localStorage**
- [ ] 所有代码已提交
