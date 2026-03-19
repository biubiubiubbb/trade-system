import { marketApi } from '../../services/marketApi';
import { useState, useEffect, useCallback } from 'react';
import { BoardItem } from './BoardItem';

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
          {typeLabels[type]} · {data.length} 只 · {lastUpdate ? lastUpdate.toLocaleTimeString() : '--'}
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
            continueBoard={stock.continueBoard}
            brokenCount={stock.brokenCount}
            onClick={() => onStockClick?.(stock.code)}
          />
        ))}
      </div>
    </div>
  );
}
