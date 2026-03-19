# 行情模块重构 - 前端实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 前端接入 SSE 实时推送，跟随新的 API 扩展字段，保留现有样式不变。

**Architecture:**
- 新增 `useRealtimeSSE` hook 订阅实时行情
- 新增 `useBidAsk` hook 获取买卖盘口
- API service 层适配新后端接口
- 现有页面渐进增强，不改变整体布局

**Tech Stack:** React 18, TypeScript, SSE, TradingView Lightweight Charts

---

## 文件结构

```
web/src/
├── hooks/
│   ├── useRealtimeSSE.ts          # 新增：SSE订阅实时行情
│   └── useBidAsk.ts               # 新增：买卖盘口
├── services/
│   └── marketApi.ts              # 新增/扩展：统一API调用
├── pages/
│   └── Market.tsx                # 扩展：接入SSE + 新增字段
├── components/
│   ├── charts/
│   │   └── KLineChart.tsx       # 复用（已有）
│   ├── market/
│   │   ├── RealtimeTicker.tsx   # 新增：实时行情行组件
│   │   └── BidAskPanel.tsx      # 新增：五档盘口组件
│   └── layout/
└── mocks/
    └── handlers/
        └── market.ts            # 扩展：适配新API
```

---

## Task 1: API Service 层

**Files:**
- Create: `web/src/services/marketApi.ts`
- Modify: `web/src/mocks/handlers/market.ts`

> **注意：** MSW 无法 mock EventSource（SSE）。`useRealtimeSSE` 的功能测试需要启动真实后端，Mock 模式下 SSE 连接会失败但不影响 REST API 测试。

- [ ] **Step 1: 创建 marketApi.ts**

```typescript
// web/src/services/marketApi.ts
const BASE_URL = '/api/v1/market';

export interface Stock {
  code: string;
  name: string;
  market: string;
  industry?: string;
  totalShares?: number;
  floatShares?: number;
  listDate?: string;
  realtime?: RealtimeData;
}

export interface BidAskLevel {
  price: number;
  vol: number;
}

export interface RealtimeData {
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
  updatedAt?: string;
  bidAsk?: {
    bid1: BidAskLevel;
    bid2: BidAskLevel;
    bid3: BidAskLevel;
    bid4: BidAskLevel;
    bid5: BidAskLevel;
    ask1: BidAskLevel;
    ask2: BidAskLevel;
    ask3: BidAskLevel;
    ask4: BidAskLevel;
    ask5: BidAskLevel;
  };
}

export interface BidAsk {
  bid1: BidAskLevel;
  bid2: BidAskLevel;
  bid3: BidAskLevel;
  bid4: BidAskLevel;
  bid5: BidAskLevel;
  ask1: BidAskLevel;
  ask2: BidAskLevel;
  ask3: BidAskLevel;
  ask4: BidAskLevel;
  ask5: BidAskLevel;
}

export interface HistoryData {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
}

export interface Sector {
  id: string;
  code: string;
  name: string;
  type: 'INDUSTRY' | 'CONCEPT';
  changePct?: number;
  volume?: number;
  amount?: number;
  netInflow?: number;
  riseCount?: number;
  fallCount?: number;
  leaderStock?: string;
  leaderStockPrice?: number;
  leaderStockChangePct?: number;
}

export interface LimitUpStock {
  code: string;
  name: string;
  changePct: number;
  price: number;
  amount: number;
  floatMarketCap?: number;
  totalMarketCap?: number;
  turnoverRate?: number;
  sealAmount?: number;
  continueBoard?: number;
  industry?: string;
  firstSealTime?: string;
  lastSealTime?: string;
  brokenCount?: number;
}

function api<T>(path: string): Promise<T> {
  return fetch(`${BASE_URL}${path}`).then((res) => {
    if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
    return res.json();
  });
}

// 股票
export const marketApi = {
  getStockList: (params: { keyword?: string; page?: number; pageSize?: number }) =>
    api<{ data: { items: Stock[]; total: number } }>(
      `/stocks?${new URLSearchParams(params as any)}`
    ).then((r) => r.data),

  getStock: (code: string) =>
    api<{ data: Stock }>(`/stocks/${code}`).then((r) => r.data),

  // 历史K线
  getHistory: (code: string, params?: { startDate?: string; endDate?: string; adjust?: string }) =>
    api<{ data: HistoryData[] }>(
      `/history/${code}?${new URLSearchParams(params as any)}`
    ).then((r) => r.data),

  // 实时行情
  getRealtime: (code: string) =>
    api<{ data: RealtimeData }>(`/realtime/${code}`).then((r) => r.data),

  getRealtimeBatch: (codes: string[]) =>
    api<{ data: RealtimeData[] }>(`/realtime/batch?codes=${codes.join(',')}`).then((r) => r.data),

  // 分钟级数据
  getMinute: (code: string, period: string = '5') =>
    api<{ data: { time: string; price: number; volume: number; amount: number }[] }>(
      `/minute/${code}?period=${period}`
    ).then((r) => r.data),

  // 涨跌幅排行
  getRankings: (type: 'up' | 'down' = 'up', limit: number = 50) =>
    api<{ data: Stock[] }>(`/rankings?type=${type}&limit=${limit}`).then((r) => r.data),

  // 板块
  getSectors: (type?: string) =>
    api<{ data: Sector[] }>(`/sectors${type ? `?type=${type}` : ''}`).then((r) => r.data),

  getSectorStocks: (sectorId: string) =>
    api<{ data: Stock[] }>(`/sectors/${sectorId}/stocks`).then((r) => r.data),

  // 涨停板
  getLimitUp: (params?: { date?: string; type?: string; page?: number; pageSize?: number }) =>
    api<{ data: { items: LimitUpStock[]; total: number } }>(
      `/limitup?${new URLSearchParams(params as any)}`
    ).then((r) => r.data),

  // 热搜
  getHot: (params?: { symbol?: string; date?: string; time?: string }) =>
    api<{ data: { name: string; code: string; changePct: string; heat: number }[] }>(
      `/hot?${new URLSearchParams(params as any)}`
    ).then((r) => r.data),
};
```

- [ ] **Step 2: 修复现有 Mock Handler（适配新字段 + 嵌套 bidAsk）**

在 `web/src/mocks/handlers/market.ts` 中，替换 `generateRealtime` 函数，并补充新的 mock handlers：

```typescript
// 替换现有的 generateRealtime 函数
const generateRealtime = (code: string, name: string) => {
  const price = faker.number.float({ min: 10, max: 100, fractionDigits: 2 });
  const prevClose = price - faker.number.float({ min: -5, max: 5, fractionDigits: 2 });
  const change = price - prevClose;
  const changePct = (change / prevClose) * 100;
  const high = price * faker.number.float({ min: 1.0, max: 1.1, fractionDigits: 2 });
  const low = price * faker.number.float({ min: 0.9, max: 1.0, fractionDigits: 2 });

  return {
    code,
    name,
    price,
    change: parseFloat(change.toFixed(2)),
    changePct: parseFloat(changePct.toFixed(2)),
    volume: faker.number.float({ min: 1000000, max: 100000000 }),
    amount: faker.number.float({ min: 10000000, max: 1000000000 }),
    high: parseFloat(high.toFixed(2)),
    low: parseFloat(low.toFixed(2)),
    open: faker.number.float({ min: prevClose * 0.9, max: prevClose * 1.1, fractionDigits: 2 }),
    prevClose: parseFloat(prevClose.toFixed(2)),
    amplitude: parseFloat(((high - low) / prevClose * 100).toFixed(2)),
    turnoverRate: faker.number.float({ min: 0.5, max: 15, fractionDigits: 2 }),
    pe: faker.number.float({ min: 5, max: 50, fractionDigits: 2 }),
    pb: faker.number.float({ min: 0.5, max: 5, fractionDigits: 2 }),
    marketCap: faker.number.float({ min: 1e8, max: 1e11 }),
    floatMarketCap: faker.number.float({ min: 5e7, max: 5e10 }),
    bidAsk: {
      bid1: { price: price - 0.01, vol: faker.number.int({ min: 1000, max: 50000 }) },
      bid2: { price: price - 0.02, vol: faker.number.int({ min: 1000, max: 50000 }) },
      bid3: { price: price - 0.03, vol: faker.number.int({ min: 1000, max: 50000 }) },
      bid4: { price: price - 0.04, vol: faker.number.int({ min: 1000, max: 50000 }) },
      bid5: { price: price - 0.05, vol: faker.number.int({ min: 1000, max: 50000 }) },
      ask1: { price: price + 0.01, vol: faker.number.int({ min: 1000, max: 50000 }) },
      ask2: { price: price + 0.02, vol: faker.number.int({ min: 1000, max: 50000 }) },
      ask3: { price: price + 0.03, vol: faker.number.int({ min: 1000, max: 50000 }) },
      ask4: { price: price + 0.04, vol: faker.number.int({ min: 1000, max: 50000 }) },
      ask5: { price: price + 0.05, vol: faker.number.int({ min: 1000, max: 50000 }) },
    },
    updatedAt: new Date().toISOString(),
  };
};
```

```typescript
// 在现有 handlers 后添加

http.get('/api/v1/market/minute/:code', ({ params }) => {
  const code = params.code;
  // 生成模拟分钟数据
  const now = Date.now();
  const data = Array.from({ length: 100 }, (_, i) => ({
    time: new Date(now - i * 60000 * 5).toISOString(),
    price: 10 + Math.random() * 2,
    volume: Math.floor(Math.random() * 10000),
    amount: Math.floor(Math.random() * 100000),
  })).reverse();
  return HttpResponse.json({ code: 0, message: 'success', data });
}),

http.get('/api/v1/market/sectors', () => {
  return HttpResponse.json({
    code: 0,
    message: 'success',
    data: [
      { id: '1', code: 'industry_科技', name: '科技', type: 'INDUSTRY', changePct: 2.5, riseCount: 45, fallCount: 12, leaderStock: '宁德时代', leaderStockPrice: 280.5, leaderStockChangePct: 4.2 },
      { id: '2', code: 'industry_医药', name: '医药', type: 'INDUSTRY', changePct: -1.3, riseCount: 20, fallCount: 35, leaderStock: '恒瑞医药', leaderStockPrice: 45.8, leaderStockChangePct: -2.1 },
    ],
  });
}),

http.get('/api/v1/market/limitup', ({ request }) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('pageSize') || '50');

  const items = Array.from({ length: 20 }, (_, i) => ({
    code: `60${String(i).padStart(4, '0')}`,
    name: `股票${i}`,
    changePct: 9.9 + Math.random(),
    price: 10 + Math.random() * 5,
    amount: Math.random() * 1e9,
    industry: '科技',
  }));

  return HttpResponse.json({
    code: 0,
    message: 'success',
    data: {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total: items.length,
      page,
      pageSize,
    },
  });
}),

http.get('/api/v1/market/hot', () => {
  return HttpResponse.json({
    code: 0,
    message: 'success',
    data: [
      { name: '比亚迪', code: '002594', changePct: '+5.2%', heat: 950000 },
      { name: '贵州茅台', code: '600519', changePct: '+2.1%', heat: 880000 },
    ],
  });
}),
```

- [ ] **Step 3: 提交**

```bash
git add web/src/services/marketApi.ts web/src/mocks/handlers/market.ts
git commit -m "feat(frontend): 添加marketApi服务层和Mock扩展"
```

---

## Task 2: SSE Hooks

**Files:**
- Create: `web/src/hooks/useRealtimeSSE.ts`
- Create: `web/src/hooks/useBidAsk.ts`

- [ ] **Step 1: 创建 useRealtimeSSE hook**

```typescript
// web/src/hooks/useRealtimeSSE.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { RealtimeData } from '../services/marketApi';

export function useRealtimeSSE(codes: string[]) {
  const [data, setData] = useState<Map<string, RealtimeData>>(new Map());
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (codes.length === 0) return;

    const url = `/api/v1/market/sse/realtime?codes=${codes.join(',')}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        // 后端每行一个 JSON 对象: "data: {}\ndata: {}\n"
        // 按换行分割，逐行解析后合并为数组
        const lines = event.data.trim().split('\n');
        const updates: RealtimeData[] = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === '[]') continue;
          try {
            const obj = JSON.parse(trimmed);
            if (obj && typeof obj === 'object') updates.push(obj);
          } catch {
            // ignore parse errors per line
          }
        }
        if (updates.length > 0) {
          setData((prev) => {
            const next = new Map(prev);
            for (const update of updates) {
              next.set(update.code, update);
            }
            return next;
          });
        }
      } catch {
        // ignore parse errors
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
      eventSource.close();

      // 使用 reconnecting 标志防止 Strict Mode 和重复 onerror 触发多次重连
      if (reconnectTimerRef.current) return;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        // useEffect 依赖 connect，connect 依赖 codes.join(',')
        // codes 不变时会重新执行 connect 建立新连接
      }, 3000);
    };
  }, [codes.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    connect();

    return () => {
      eventSourceRef.current?.close();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connect]);

  return { data, connected };
}
```

- [ ] **Step 2: 创建 useBidAsk hook（定时轮询盘口）**

> **轮询策略：** bidAsk 变化频繁，按 3 秒间隔轮询直到手动停止。代码切换时清理定时器。

```typescript
// web/src/hooks/useBidAsk.ts
import { useState, useEffect, useRef } from 'react';
import { marketApi, BidAsk } from '../services/marketApi';

export function useBidAsk(code: string | null, intervalMs: number = 3000) {
  const [data, setData] = useState<BidAsk | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBidAsk = async () => {
    if (!code) return;
    try {
      const realtime = await marketApi.getRealtime(code);
      if (realtime?.bidAsk) {
        setData(realtime.bidAsk);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!code) {
      setData(null);
      return;
    }

    // 首次立即获取，后续定时轮询
    fetchBidAsk();
    setLoading(false);
    timerRef.current = setInterval(fetchBidAsk, intervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [code, intervalMs]);

  return { data, loading };
}
```

**优化提示：** 如果后端 SSE 数据中已包含 `bidAsk`（在 `RealtimeData.bidAsk` 中），可将轮询替换为从 SSE 缓存中读取，参考 `useRealtimeSSE` 的 `data` Map 中对应股票的 `bidAsk` 字段，避免重复请求。

- [ ] **Step 3: 提交**

```bash
git add web/src/hooks/useRealtimeSSE.ts web/src/hooks/useBidAsk.ts
git commit -m "feat(frontend): 添加SSE实时行情hooks"
```

---

## Task 3: 市场页面增强

**Files:**
- Modify: `web/src/pages/Market.tsx`
- Create: `web/src/components/market/RealtimeTicker.tsx`
- Create: `web/src/components/market/BidAskPanel.tsx`

- [ ] **Step 1: 创建 RealtimeTicker 组件（实时行情行）**

```typescript
// web/src/components/market/RealtimeTicker.tsx
import { RealtimeData } from '../../services/marketApi';

interface Props {
  code: string;
  name: string;
  realtime?: RealtimeData;
  selected?: boolean;
  onClick?: () => void;
}

export function RealtimeTicker({ code, name, realtime, selected, onClick }: Props) {
  const price = realtime?.price ?? 0;
  const changePct = realtime?.changePct ?? 0;
  const isUp = changePct >= 0;

  return (
    <div
      className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
        selected ? 'bg-blue-50' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex justify-between items-center">
        <div>
          <span className="font-medium">{name}</span>
          <span className="ml-2 text-xs text-gray-400">{code}</span>
        </div>
        <span
          className={`text-lg font-bold ${isUp ? 'text-up' : 'text-down'}`}
        >
          {price > 0 ? price.toFixed(2) : '--'}
        </span>
      </div>
      <div className="flex justify-between mt-1 text-sm">
        <span className="text-gray-500">{realtime?.industry || ''}</span>
        <span
          className={`${isUp ? 'text-up' : 'text-down'}`}
        >
          {changePct !== 0 ? `${isUp ? '+' : ''}${changePct.toFixed(2)}%` : '--'}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 BidAskPanel 组件（五档盘口）**

```typescript
// web/src/components/market/BidAskPanel.tsx
import { BidAsk } from '../../services/marketApi';

interface Props {
  bidAsk: BidAsk | null;
  loading?: boolean;
}

export function BidAskPanel({ bidAsk, loading }: Props) {
  if (loading) return <div className="text-gray-400">加载中...</div>;
  if (!bidAsk) return null;

  const bids = [bidAsk.bid1, bidAsk.bid2, bidAsk.bid3, bidAsk.bid4, bidAsk.bid5];
  const asks = [bidAsk.ask1, bidAsk.ask2, bidAsk.ask3, bidAsk.ask4, bidAsk.ask5];

  const formatVol = (vol: number) => {
    if (vol >= 1e8) return (vol / 1e8).toFixed(2) + '亿';
    if (vol >= 1e4) return (vol / 1e4).toFixed(2) + '万';
    return vol.toFixed(0);
  };

  return (
    <div className="text-sm">
      <div className="grid grid-cols-2 gap-2">
        {/* 卖盘（5档） */}
        <div>
          <div className="text-xs text-gray-400 mb-1">卖盘</div>
          {[...asks].reverse().map((ask, i) => (
            <div key={`ask-${i}`} className="flex justify-between text-down">
              <span className="text-gray-400">{ask.price.toFixed(2)}</span>
              <span>{formatVol(ask.vol)}</span>
            </div>
          ))}
        </div>
        {/* 买盘（5档） */}
        <div>
          <div className="text-xs text-gray-400 mb-1">买盘</div>
          {bids.map((bid, i) => (
            <div key={`bid-${i}`} className="flex justify-between text-up">
              <span className="text-gray-400">{bid.price.toFixed(2)}</span>
              <span>{formatVol(bid.vol)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 更新 Market.tsx（接入 SSE + 扩展字段）**

读取现有的 `web/src/pages/Market.tsx`，然后在以下位置增强：

1. **顶部引入**：
```typescript
import { marketApi, RealtimeData } from '../services/marketApi';
import { useRealtimeSSE } from '../hooks/useRealtimeSSE';
import { useBidAsk } from '../hooks/useBidAsk';
import { BidAskPanel } from '../components/market/BidAskPanel';
```

2. **SSE 订阅**（在组件内部）：
```typescript
export function Market() {
  // ... 现有 state ...

  // 新增：获取股票代码列表用于 SSE
  const stockCodes = stocks.map((s) => s.code);

  // 新增：SSE 订阅实时数据
  const { data: realtimeMap } = useRealtimeSSE(stockCodes);

  // ... 现有逻辑 ...
}
```

3. **股票列表渲染增强**（将 realtime prop 替换为 SSE 数据）：
```tsx
// 在左侧股票列表中，将静态 realtime 替换为 SSE 实时数据
{stocks.map((stock) => (
  <RealtimeTicker
    key={stock.code}
    code={stock.code}
    name={stock.name}
    realtime={realtimeMap.get(stock.code)}
    selected={selectedCode === stock.code}
    onClick={() => handleSelectStock(stock.code)}
  />
))}
```

4. **个股详情扩展字段**（在右侧详情区域扩展）：
```tsx
{/* 在现有价格信息下方添加新字段 */}
<div className="grid grid-cols-4 gap-4">
  {[
    { label: '换手率', value: selectedStock.realtime?.turnoverRate ? `${selectedStock.realtime.turnoverRate.toFixed(2)}%` : '--' },
    { label: '市盈率', value: selectedStock.realtime?.pe ? selectedStock.realtime.pe.toFixed(2) : '--' },
    { label: '市净率', value: selectedStock.realtime?.pb ? selectedStock.realtime.pb.toFixed(2) : '--' },
    { label: '总市值', value: selectedStock.realtime?.marketCap ? formatMarketCap(selectedStock.realtime.marketCap) : '--' },
    { label: '流通市值', value: selectedStock.realtime?.floatMarketCap ? formatMarketCap(selectedStock.realtime.floatMarketCap) : '--' },
    { label: '振幅', value: selectedStock.realtime?.amplitude ? `${selectedStock.realtime.amplitude.toFixed(2)}%` : '--' },
  ].map((item) => (
    <div key={item.label} className="p-4 bg-white rounded shadow">
      <div className="text-sm text-gray-500">{item.label}</div>
      <div className="text-lg font-bold">{item.value}</div>
    </div>
  ))}
</div>

{/* 添加五档盘口 */}
<BidAskPanel bidAsk={bidAsk} />
```

辅助函数：
```typescript
function formatMarketCap(value: number): string {
  if (value >= 1e12) return (value / 1e12).toFixed(2) + '万亿';
  if (value >= 1e8) return (value / 1e8).toFixed(2) + '亿';
  return (value / 1e4).toFixed(2) + '万';
}
```

- [ ] **Step 4: 提交**

```bash
git add web/src/pages/Market.tsx web/src/components/market/
git commit -m "feat(frontend): Market页面接入SSE，扩展实时字段和盘口"
```

---

## Task 4: 构建验证

- [ ] **Step 1: 运行构建**

Run: `cd web && pnpm build`
Expected: BUILD SUCCESS

- [ ] **Step 2: 启动前端验证**

Run: `cd web && pnpm dev`
Expected: 前端启动成功，无编译错误

- [ ] **Step 3: 验证 SSE 连接（需启动真实后端）**

> **前提：** 必须先启动后端服务（`cd server && pnpm start:dev`），MSW 无法 mock EventSource。

在浏览器中打开 Market 页面，验证：
- SSE 连接建立（Network 面板有 `/api/v1/market/sse/realtime` 请求）
- 连接建立后自动收到实时数据推送
- 断线后自动重连（3秒后重新连接）

- [ ] **Step 4: 提交**

```bash
git add web/src/
git commit -m "feat(frontend): 完成行情页面SSE接入和字段扩展"
```

---

## 验证检查清单

- [ ] `useRealtimeSSE` hook 正常订阅并更新数据
- [ ] `useBidAsk` hook 正常获取盘口数据
- [ ] 股票列表随 SSE 数据实时刷新
- [ ] 个股详情新增字段（换手率/PE/PB/市值/振幅）正常显示
- [ ] 五档盘口 BidAskPanel 正常渲染
- [ ] 现有样式完全保留，无布局破坏
- [ ] 前端构建成功
- [ ] 所有代码已提交
