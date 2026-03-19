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
