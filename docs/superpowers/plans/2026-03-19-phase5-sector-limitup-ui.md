# 板块和涨停板行情 UI 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Market 页面增加 Tab 结构，支持板块和涨停板功能

**Architecture:** Tab-based UI 方案 - 在 Market.tsx 中增加 `板块` 和 `涨停板` 两个 Tab，与现有 `行情` Tab 并列

**Tech Stack:** React 18 + TypeScript + TailwindCSS + Radix UI

**Design:** 三主题适配（financial/cartoon/minimal），每主题独特视觉风格

---

## 文件结构

### 后端（已完成）
- `server/src/services/data-gateway/types.ts` - ✅ 已添加新类型
- `server/src/services/data-gateway/adapters/aktools.adapter.ts` - ✅ 已实现 fallback 逻辑
- `server/src/services/data-gateway/data-gateway.service.ts` - ✅ 已暴露新方法
- `server/src/modules/market/market.service.ts` - ✅ 已添加服务方法
- `server/src/modules/market/market.controller.ts` - ✅ 已添加 API 路由

### 前端（待实现）

| 文件 | 变更 |
|------|------|
| `web/src/services/marketApi.ts` | 已添加新 API 方法（完成） |
| `web/src/mocks/handlers/market.ts` | 已添加 mock handlers（完成） |
| `web/src/pages/Market.tsx` | 修改：增加 Tab 结构 |
| `web/src/components/market/BoardItem.tsx` | 新建：通用板块/涨停项目组件 |
| `web/src/components/market/SectorList.tsx` | 新建：板块列表组件 |
| `web/src/components/market/LimitUpList.tsx` | 新建：涨停板列表组件 |
| `web/src/components/market/BoardHistoryModal.tsx` | 新建：板块指数历史 Modal |

---

## Task 1: 创建通用列表组件 BoardItem

**Files:**
- Create: `web/src/components/market/BoardItem.tsx`

由于 RealtimeTicker 组件结构复杂，为避免破坏现有功能，新建 `BoardItem` 组件专门用于板块和涨停板列表。支持三主题差异化设计。

- [ ] **Step 1: 创建 BoardItem 组件**

```typescript
import { useTheme } from '../../theme/ThemeContext';

interface BoardItemProps {
  type: 'sector' | 'limitup';
  // sector 模式
  name?: string;
  changePct?: number;
  riseCount?: number;
  fallCount?: number;
  leaderStock?: string;
  // limitup 模式
  code?: string;
  price?: number;
  amount?: number;
  continueBoard?: number;
  brokenCount?: number;
  onClick?: () => void;
}

export function BoardItem({
  type,
  name,
  changePct,
  riseCount,
  fallCount,
  leaderStock,
  code,
  price,
  amount,
  continueBoard,
  brokenCount,
  onClick,
}: BoardItemProps) {
  const { theme } = useTheme();
  const isUp = changePct !== undefined && changePct >= 0;

  const isFinancial = theme === 'financial';
  const isCartoon = theme === 'cartoon';
  const isMinimal = theme === 'minimal';

  // === Financial Theme: 毛玻璃 + 发光边框 ===
  if (isFinancial) {
    return (
      <div
        onClick={onClick}
        className="group relative p-3 cursor-pointer rounded-lg transition-all duration-300"
        style={{
          background: 'rgba(30, 41, 59, 0.6)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
          e.currentTarget.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.2)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {type === 'sector' ? (
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-sm text-gray-100">{name}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                上涨 <span className="text-red-400">{riseCount || 0}</span> / 下跌 <span className="text-green-400">{fallCount || 0}</span>
              </div>
              {leaderStock && (
                <div className="text-xs text-gray-500 mt-0.5">
                  领涨: {leaderStock}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className={`text-xl font-bold ${isUp ? 'text-red-400' : 'text-green-400'}`}>
                {changePct !== undefined ? `${isUp ? '+' : ''}${changePct.toFixed(2)}%` : '--'}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-sm text-gray-100">{name}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {code}
                {continueBoard !== undefined && continueBoard > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                    {continueBoard}连板
                  </span>
                )}
                {brokenCount !== undefined && brokenCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs">
                    {brokenCount}次炸板
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className={`text-xl font-bold ${isUp ? 'text-red-400' : 'text-green-400'}`}>
                {changePct !== undefined ? `${isUp ? '+' : ''}${changePct.toFixed(2)}%` : '--'}
              </div>
              <div className="text-xs text-gray-400">
                ¥{price?.toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // === Cartoon Theme: 像素风格 ===
  if (isCartoon) {
    return (
      <div
        onClick={onClick}
        className="relative p-3 cursor-pointer transition-transform duration-100"
        style={{
          background: 'var(--color-surface)',
          border: '3px solid var(--color-border)',
          boxShadow: '4px 4px 0px var(--color-border)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translate(-2px, -2px)';
          e.currentTarget.style.boxShadow = '6px 6px 0px var(--color-border)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translate(0, 0)';
          e.currentTarget.style.boxShadow = '4px 4px 0px var(--color-border)';
        }}
      >
        {type === 'sector' ? (
          <div className="flex justify-between items-center">
            <div>
              <div className="font-heading text-sm text-gray-800">{name}</div>
              <div className="font-mono text-xs text-gray-600 mt-0.5">
                <span className="text-red-500">▲{riseCount || 0}</span> / <span className="text-green-500">▼{fallCount || 0}</span>
              </div>
              {leaderStock && (
                <div className="font-mono text-xs text-gray-500 mt-0.5">
                  ★ {leaderStock}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className={`font-mono text-lg font-bold ${isUp ? 'text-red-500' : 'text-green-500'}`}>
                {changePct !== undefined ? `${isUp ? '+' : ''}${changePct.toFixed(1)}%` : '--'}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <div>
              <div className="font-heading text-sm text-gray-800">{name}</div>
              <div className="font-mono text-xs text-gray-600 mt-0.5">
                {code}
                {continueBoard !== undefined && continueBoard > 0 && (
                  <span className="ml-1 bg-yellow-300 text-gray-800 px-1 text-xs">
                    ×{continueBoard}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className={`font-mono text-lg font-bold ${isUp ? 'text-red-500' : 'text-green-500'}`}>
                {changePct !== undefined ? `${isUp ? '+' : ''}${changePct.toFixed(1)}%` : '--'}
              </div>
              <div className="font-mono text-xs text-gray-600">
                ¥{price?.toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // === Minimal Theme: 极致简洁 ===
  return (
    <div
      onClick={onClick}
      className="group p-3 cursor-pointer border-b border-gray-200 transition-colors duration-200 hover:bg-gray-50"
    >
      {type === 'sector' ? (
        <div className="flex justify-between items-center">
          <div>
            <div className="font-medium text-sm text-black">{name}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {riseCount || 0}↑ {fallCount || 0}↓
              {leaderStock && <span className="ml-2">· {leaderStock}</span>}
            </div>
          </div>
          <div className={`text-lg font-light ${isUp ? 'text-black' : 'text-gray-400'}`}>
            {changePct !== undefined ? `${isUp ? '+' : ''}${changePct.toFixed(2)}%` : '--'}
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-center">
          <div>
            <div className="font-medium text-sm text-black">{name}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {code}
              {continueBoard !== undefined && continueBoard > 0 && (
                <span className="ml-1">{continueBoard}连板</span>
              )}
            </div>
          </div>
          <div className={`text-lg font-light ${isUp ? 'text-black' : 'text-gray-400'}`}>
            {changePct !== undefined ? `${isUp ? '+' : ''}${changePct.toFixed(2)}%` : '--'}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/market/BoardItem.tsx
git commit -m "feat(ui): create BoardItem component with three-theme support"
```

---

## Task 2: 创建板块列表组件

**Files:**
- Create: `web/src/components/market/SectorList.tsx`

- [ ] **Step 1: 创建 SectorList 组件**

```typescript
import { marketApi, Sector } from '../../services/marketApi';
import { useState, useEffect, useCallback } from 'react';
import { BoardItem } from './BoardItem';

interface SectorListProps {
  type: 'industry' | 'concept';
  onBoardClick?: (name: string) => void;
}

export function SectorList({ type, onBoardClick }: SectorListProps) {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await marketApi.getSectors(type.toUpperCase());
      setSectors(data);
      setLastUpdate(new Date());
    } catch (e) {
      setError('加载失败');
      console.error('Failed to load sectors:', e);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading && sectors.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-gray-500 text-sm">加载中...</div>
      </div>
    );
  }

  if (error && sectors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <div className="text-red-500 text-sm">{error}</div>
        <button
          onClick={loadData}
          className="text-blue-500 text-sm hover:underline"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 状态栏：更新时间 + 刷新按钮 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="text-xs text-gray-500">
          最后更新: {lastUpdate?.toLocaleTimeString() || '--'}
        </div>
        <button
          onClick={loadData}
          className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
          disabled={loading}
        >
          <svg
            className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="text-xs text-orange-500 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20">
          数据可能不是最新的
        </div>
      )}

      {/* 板块列表 */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
        {sectors.map(sector => (
          <BoardItem
            key={sector.id}
            type="sector"
            name={sector.name}
            changePct={sector.changePct}
            riseCount={sector.riseCount}
            fallCount={sector.fallCount}
            leaderStock={sector.leaderStock}
            onClick={() => onBoardClick?.(sector.name)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/market/SectorList.tsx
git commit -m "feat(ui): create SectorList component with refresh UI"
```

---

## Task 3: 创建涨停板列表组件

**Files:**
- Create: `web/src/components/market/LimitUpList.tsx`

注意：`getLimitUp()` 返回 `{ items: LimitUpStock[], total: number }`，而其他 API 返回数组。使用 Radix UI Select 组件实现股池类型切换。

- [ ] **Step 1: 创建 LimitUpList 组件**

```typescript
import { marketApi } from '../../services/marketApi';
import { useState, useEffect, useCallback } from 'react';
import { BoardItem } from './BoardItem';
import * as Select from '@radix-ui/react-select';
import { useTheme } from '../../theme/ThemeContext';

type LimitUpType = 'up' | 'previous' | 'subnew' | 'broken' | 'down';

interface LimitUpListProps {
  type: LimitUpType;
  onStockClick?: (code: string) => void;
}

const typeLabels: Record<LimitUpType, string> = {
  up: '今日涨停',
  previous: '昨日涨停',
  subnew: '次新股',
  broken: '炸板股',
  down: '跌停股',
};

export function LimitUpList({ type, onStockClick }: LimitUpListProps) {
  const { theme } = useTheme();
  const isFinancial = theme === 'financial';
  const isCartoon = theme === 'cartoon';
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      let result: any[] = [];

      switch (type) {
        case 'up': {
          const res = await marketApi.getLimitUp({ pageSize: 100 });
          result = res.items;
          break;
        }
        case 'previous':
          result = await marketApi.getPreviousLimitUp();
          break;
        case 'subnew':
          result = await marketApi.getSubNewStocks();
          break;
        case 'broken':
          result = await marketApi.getBrokenLimitUp();
          break;
        case 'down':
          result = await marketApi.getLimitDown();
          break;
      }

      setData(result || []);
      setLastUpdate(new Date());
    } catch (e) {
      setError('加载失败');
      console.error('Failed to load limitup data:', e);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-gray-500 text-sm">加载中...</div>
      </div>
    );
  }

  if (error && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <div className="text-red-500 text-sm">{error}</div>
        <button
          onClick={loadData}
          className="text-blue-500 text-sm hover:underline"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 状态栏：类型 + 数量 + 刷新 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="text-xs text-gray-500">
          {typeLabels[type]} · {data.length} 只
        </div>
        <button
          onClick={loadData}
          className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
          disabled={loading}
        >
          <svg
            className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="text-xs text-orange-500 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20">
          数据可能不是最新的
        </div>
      )}

      {/* 涨停板列表 */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
        {data.map(stock => (
          <BoardItem
            key={stock.code}
            type="limitup"
            name={stock.name}
            code={stock.code}
            changePct={stock.changePct}
            price={stock.price}
            amount={stock.amount}
            continueBoard={stock.continueBoard}
            brokenCount={stock.brokenCount}
            onClick={() => onStockClick?.(stock.code)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/market/LimitUpList.tsx
git commit -m "feat(ui): create LimitUpList component with refresh UI"
```

---

## Task 4: 创建板块指数历史 Modal

**Files:**
- Create: `web/src/components/market/BoardHistoryModal.tsx`

- [ ] **Step 1: 创建 BoardHistoryModal 组件**

```typescript
import { marketApi } from '../../services/marketApi';
import { KLineChart } from '../charts/KLineChart';
import { useState, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTheme } from '../../theme/ThemeContext';

interface BoardHistoryModalProps {
  boardName: string;
  boardType: 'concept' | 'industry';
  open: boolean;
  onClose: () => void;
}

export function BoardHistoryModal({ boardName, boardType, open, onClose }: BoardHistoryModalProps) {
  const { theme } = useTheme();
  const isFinancial = theme === 'financial';
  const isCartoon = theme === 'cartoon';
  const isMinimal = theme === 'minimal';
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = boardType === 'concept'
        ? await marketApi.getConceptBoardIndex(boardName)
        : await marketApi.getIndustryBoardIndex(boardName);
      setHistory(data.map(d => ({
        date: d.date,
        open: d.open,
        close: d.close,
        high: d.high,
        low: d.low,
        volume: d.volume,
      })));
    } catch (e) {
      console.error('Failed to load board history:', e);
    } finally {
      setLoading(false);
    }
  }, [boardName, boardType]);

  useEffect(() => {
    if (open && boardName) {
      loadData();
    }
  }, [open, boardName, boardType, loadData]);

  // 响应式宽度
  const modalWidth = isMinimal ? '95vw' : isFinancial ? '800px' : '700px';

  return (
    <Dialog.Root open={open} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 bg-black/50 animate-in fade-in duration-200"
          style={{ backdropFilter: isFinancial ? 'blur(4px)' : undefined }}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg overflow-hidden"
          style={{
            width: modalWidth,
            maxWidth: '95vw',
            maxHeight: '85vh',
            backgroundColor: isCartoon ? 'var(--color-surface)' : (isMinimal ? '#FFFFFF' : 'var(--color-surface)'),
            border: isCartoon ? '4px solid var(--color-border)' : (isMinimal ? 'none' : '1px solid var(--color-border)'),
            boxShadow: isCartoon ? '8px 8px 0px var(--color-border)' : undefined,
          }}
        >
          {/* Header */}
          <div
            className="flex justify-between items-center p-4"
            style={{
              borderBottom: isCartoon ? '3px solid var(--color-border)' : '1px solid var(--color-border)',
            }}
          >
            <Dialog.Title
              className="text-lg font-semibold"
              style={{
                fontFamily: isCartoon ? 'var(--font-heading)' : undefined,
                color: 'var(--color-text)',
              }}
            >
              {boardName} - 指数历史
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="text-gray-500 hover:text-gray-700 transition-colors p-1"
                aria-label="关闭"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div
            className="p-4 overflow-y-auto"
            style={{ maxHeight: 'calc(85vh - 70px)' }}
          >
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">加载中...</div>
              </div>
            ) : (
              <KLineChart data={history} height={400} />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/market/BoardHistoryModal.tsx
git commit -m "feat(ui): create BoardHistoryModal with Radix UI Dialog"
```

---

## Task 5: 修改 Market.tsx 增加 Tab 结构

**Files:**
- Modify: `web/src/pages/Market.tsx`

使用 Radix UI Tabs 实现三主题适配的 Tab 切换。

- [ ] **Step 1: 添加 import 和 state**

```typescript
// 在文件顶部添加新的 import
import * as Tabs from '@radix-ui/react-tabs';
import { SectorList } from '../components/market/SectorList';
import { LimitUpList } from '../components/market/LimitUpList';
import { BoardHistoryModal } from '../components/market/BoardHistoryModal';
import * as Select from '@radix-ui/react-select';

// 在现有 state 后添加
const [activeTab, setActiveTab] = useState<'market' | 'sector' | 'limitup'>('market');
const [sectorType, setSectorType] = useState<'industry' | 'concept'>('industry');
const [limitUpType, setLimitUpType] = useState<'up' | 'previous' | 'subnew' | 'broken' | 'down'>('up');
const [selectedBoard, setSelectedBoard] = useState<{ name: string; type: 'concept' | 'industry' } | null>(null);
```

- [ ] **Step 2: 替换左侧边栏内容区域**

找到左侧边栏的 `<div className="flex-1 overflow-y-auto">` 及其包含的股票列表，替换为：

```typescript
{/* Left: Tabbed content */}
<div
  className={`flex flex-col ${sidebarW} shrink-0`}
  style={{
    backgroundColor: isCartoon ? 'var(--color-surface-dark)' : 'var(--color-surface)',
    borderRight: isCartoon ? '3px solid var(--color-border)' : (isMinimal ? 'none' : '1px solid var(--color-border)'),
    backgroundImage: isCartoon
      ? 'repeating-linear-gradient(90deg, transparent, transparent 23px, rgba(0,0,0,0.08) 23px, rgba(0,0,0,0.08) 25px), repeating-linear-gradient(0deg, transparent, transparent 11px, rgba(0,0,0,0.08) 11px, rgba(0,0,0,0.08) 13px)'
      : isFinancial
      ? 'linear-gradient(180deg, rgba(59,130,246,0.03) 0%, transparent 100%)'
      : undefined,
    backdropFilter: isFinancial ? 'blur(12px)' : undefined,
  }}
>
  {/* Search + SSE Status */}
  <div
    className="p-3 space-y-2"
    style={{ borderBottom: isCartoon ? '3px solid var(--color-border)' : '1px solid var(--color-border)' }}
  >
    <SSEStatus connected={connected} count={stockCodes.length} />

    {isCartoon ? (
      <input
        type="text" placeholder="搜索..." value={keyword} onChange={e => setKeyword(e.target.value)}
        className="w-full px-2 py-2 border-2"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontSize: 8 }}
      />
    ) : isMinimal ? (
      <input
        type="text" placeholder="搜索" value={keyword} onChange={e => setKeyword(e.target.value)}
        className="w-full px-2 py-2"
        style={{ background: 'transparent', borderBottom: '1px solid var(--color-border)', borderTop: 'none', borderLeft: 'none', borderRight: 'none', color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontSize: 12 }}
      />
    ) : (
      <input
        type="text" placeholder="搜索股票代码或名称..." value={keyword} onChange={e => setKeyword(e.target.value)}
        className="w-full px-3 py-2 rounded"
        style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 13 }}
      />
    )}
  </div>

  {/* Tab Navigation */}
  <Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex flex-col h-full">
    <Tabs.List
      className="flex shrink-0"
      style={{
        borderBottom: isCartoon ? '3px solid var(--color-border)' : '1px solid var(--color-border)',
      }}
    >
      {[
        { value: 'market', label: '行情' },
        { value: 'sector', label: '板块' },
        { value: 'limitup', label: '涨停' },
      ].map((tab) => (
        <Tabs.Trigger
          key={tab.value}
          value={tab.value}
          className="flex-1 py-2 text-xs transition-colors duration-200 relative"
          style={{
            color: 'var(--color-text-secondary)',
            backgroundColor: 'transparent',
            borderBottom: '2px solid transparent',
          }}
        >
          {tab.label}
          {activeTab === tab.value && (
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{
                backgroundColor: isFinancial ? '#3B82F6' : (isCartoon ? 'var(--color-border)' : '#000'),
              }}
            />
          )}
        </Tabs.Trigger>
      ))}
    </Tabs.List>

    {/* Market Tab Content */}
    <Tabs.Content value="market" className="flex-1 overflow-y-auto">
      {stocks.map((stock) => {
        const realtime = realtimeMap.get(stock.code) || stock.realtime;
        return (
          <RealtimeTicker
            key={stock.code}
            code={stock.code}
            name={stock.name}
            industry={stock.industry}
            realtime={realtime}
            selected={selectedCode === stock.code}
            onClick={() => setSearchParams({ code: stock.code })}
          />
        );
      })}
    </Tabs.Content>

    {/* Sector Tab Content */}
    <Tabs.Content value="sector" className="flex-1 flex flex-col overflow-hidden">
      {/* 行业/概念切换 */}
      <div className="flex shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <button
          className={`flex-1 py-2 text-xs transition-colors ${sectorType === 'industry' ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}
          style={{ color: sectorType === 'industry' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
          onClick={() => setSectorType('industry')}
        >
          行业
        </button>
        <button
          className={`flex-1 py-2 text-xs transition-colors ${sectorType === 'concept' ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}
          style={{ color: sectorType === 'concept' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
          onClick={() => setSectorType('concept')}
        >
          概念
        </button>
      </div>
      {/* 板块列表 */}
      <div className="flex-1 overflow-hidden">
        <SectorList
          type={sectorType}
          onBoardClick={(name) => setSelectedBoard({ name, type: sectorType })}
        />
      </div>
    </Tabs.Content>

    {/* LimitUp Tab Content */}
    <Tabs.Content value="limitup" className="flex-1 flex flex-col overflow-hidden">
      {/* 股池类型选择 - 使用 Radix UI Select */}
      <div className="p-2 shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <Select.Root
          value={limitUpType}
          onValueChange={(v) => setLimitUpType(v as any)}
        >
          <Select.Trigger
            className="w-full px-3 py-2 text-xs rounded flex items-center justify-between"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: isCartoon ? '2px solid var(--color-border)' : '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            <Select.Value />
            <Select.Icon>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content
              className="overflow-hidden rounded shadow-lg"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <Select.Viewport className="p-1">
                {(['up', 'previous', 'subnew', 'broken', 'down'] as const).map((t) => (
                  <Select.Item
                    key={t}
                    value={t}
                    className="px-3 py-2 text-xs cursor-pointer rounded outline-none transition-colors"
                    style={{ color: 'var(--color-text)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Select.ItemText>{typeLabels[t]}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>
      {/* 涨停板列表 */}
      <div className="flex-1 overflow-hidden">
        <LimitUpList
          type={limitUpType}
          onStockClick={(code) => {
            setSearchParams({ code });
            setActiveTab('market');
          }}
        />
      </div>
    </Tabs.Content>
  </Tabs.Root>
</div>
```

- [ ] **Step 3: 添加 BoardHistoryModal**

在 return 的 JSX 末尾（`</div>` 闭合 Market 主容器之前）添加：

```typescript
// Board History Modal
<BoardHistoryModal
  open={!!selectedBoard}
  boardName={selectedBoard?.name || ''}
  boardType={selectedBoard?.type || 'industry'}
  onClose={() => setSelectedBoard(null)}
/>
```

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/Market.tsx
git commit -m "feat(ui): add sector and limitup tabs to Market page"
```

---

## Task 6: 验证和测试

- [ ] **Step 1: 运行前端构建**

```bash
cd web && pnpm build
```

Expected: Build successful with no errors

- [ ] **Step 2: 启动前端开发服务器**

```bash
cd web && pnpm dev
```

- [ ] **Step 3: 手动测试**

1. 打开 http://localhost:5173
2. 切换三种主题，验证 BoardItem 样式差异
3. 点击 `板块` Tab，验证板块列表显示
4. 切换行业/概念，验证列表切换
5. 点击板块名称，验证 Modal 弹出并显示 K 线图
6. 切换到 `涨停板` Tab
7. 选择不同股池类型，验证列表切换
8. 点击股票，验证跳转回行情 Tab

---

## 验收标准

1. ✅ Market 页面包含 3 个 Tab：行情、板块、涨停
2. ✅ 板块 Tab 包含行业/概念子切换
3. ✅ 点击板块名称弹出 Modal 显示指数历史 K 线
4. ✅ 涨停板 Tab 包含股池类型下拉选择（Radix UI Select）
5. ✅ 支持：今日涨停、昨日涨停、次新股、炸板股、跌停股
6. ✅ 列表数据每 5 分钟自动刷新
7. ✅ 显示最后更新时间，支持手动刷新
8. ✅ 点击股票可跳转回行情 Tab
9. ✅ 三主题差异化设计（financial 毛玻璃发光/cartoon 像素风/minimal 极简）
10. ✅ 前端构建无错误

---

## 备注

- 数据刷新策略：手动刷新 + 5分钟自动轮询
- 容错机制：后端 DataGateway 内部已实现 fallback（A失败调B）
- 前端 mock handlers 已准备好，联调时可切换到真实 API
- 使用 Radix UI Dialog 替代原生 Modal，Tab 切换使用 Radix UI Tabs
