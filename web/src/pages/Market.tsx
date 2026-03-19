import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { KLineChart } from '../components/charts/KLineChart';
import { useTheme } from '../theme/ThemeContext';
import { RealtimeData } from '../services/marketApi';
import { useRealtimeSSE } from '../hooks/useRealtimeSSE';
import { useBidAsk } from '../hooks/useBidAsk';
import { BidAskPanel } from '../components/market/BidAskPanel';
import { RealtimeTicker } from '../components/market/RealtimeTicker';

interface Stock {
  code: string;
  name: string;
  market: string;
  industry?: string;
  realtime?: RealtimeData;
}
interface HistoryData {
  date: string; open: number; close: number;
  high: number; low: number; volume: number;
}

function formatMarketCap(value: number): string {
  if (value >= 1e12) return (value / 1e12).toFixed(2) + '万亿';
  if (value >= 1e8) return (value / 1e8).toFixed(2) + '亿';
  return (value / 1e4).toFixed(2) + '万';
}

// SSE Connection Status Indicator
function SSEStatus({ connected, count }: { connected: boolean; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-2 h-2 rounded-full transition-all duration-300 ${connected ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-red-400 animate-pulse'}`}
      />
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--color-text-secondary)',
        }}
      >
        {connected ? `${count}只实时` : '离线'}
      </span>
    </div>
  );
}

// Loading skeleton for stats
function StatsSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            padding: 16,
            backgroundColor: 'var(--color-surface)',
            borderRadius: 4,
            border: '1px solid var(--color-border)',
          }}
        >
          <div
            className="h-3 rounded mb-2"
            style={{ width: '60%', backgroundColor: 'var(--color-border)' }}
          />
          <div
            className="h-5 rounded"
            style={{ width: '80%', backgroundColor: 'var(--color-border)' }}
          />
        </div>
      ))}
    </div>
  );
}

export function Market() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCode = searchParams.get('code');
  const { theme } = useTheme();

  const [stocks, setStocks] = useState<Stock[]>([]);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [historyData, setHistoryData] = useState<HistoryData[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  const isFinancial = theme === 'financial';
  const isCartoon = theme === 'cartoon';
  const isMinimal = theme === 'minimal';

  // SSE subscription
  const stockCodes = stocks.map((s) => s.code);
  const { data: realtimeMap, connected } = useRealtimeSSE(stockCodes);

  // BidAsk for selected stock
  const { data: bidAsk } = useBidAsk(selectedCode);

  useEffect(() => {
    const params = new URLSearchParams();
    if (keyword) params.set('keyword', keyword);
    params.set('pageSize', '100');
    fetch(`/api/v1/market/stocks?${params}`)
      .then(r => r.json())
      .then(j => setStocks(j.data?.items || []));
  }, [keyword]);

  useEffect(() => {
    if (!selectedCode) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/v1/market/stocks/${selectedCode}`).then(r => r.json()),
      fetch(`/api/v1/market/history/${selectedCode}`).then(r => r.json()),
    ]).then(([stockJson, historyJson]) => {
      setSelectedStock(stockJson.data);
      setHistoryData(historyJson.data || []);
    }).finally(() => setLoading(false));
  }, [selectedCode]);

  const fmt = (n: number | undefined, d = 2) => n != null ? n.toFixed(d) : '--';
  const isUp = (s: Stock | null) => s?.realtime?.changePct != null && s.realtime.changePct >= 0;

  const cardClass = isFinancial ? 'glass-card' : isCartoon ? 'pixel-card' : 'swiss-card';

  // Financial theme: sidebar width 220, cartoon: 200, minimal: 80
  const sidebarW = isMinimal ? 'w-[80px]' : isFinancial ? 'w-[220px]' : 'w-[200px]';

  // Merge SSE data with stock data for selected stock
  const selectedRealtime = selectedCode ? realtimeMap.get(selectedCode) : null;
  const displayStock = selectedStock ? {
    ...selectedStock,
    realtime: selectedRealtime || selectedStock.realtime,
  } : null;

  return (
    <div className="flex h-full">
      {/* Left: Stock list */}
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

        {/* List - using RealtimeTicker */}
        <div className="flex-1 overflow-y-auto">
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
        </div>
      </div>

      {/* Right: Detail */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--color-background)' }}>
        {displayStock ? (
          <div className="p-6">
            {/* Header */}
            <div className="mb-6">
              {isMinimal ? (
                <div>
                  <div className="page-title">{displayStock.code}</div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 48, letterSpacing: '0.05em', color: 'var(--color-text)', lineHeight: 1 }}>
                    {displayStock.name}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline gap-3">
                    <h1 className={isFinancial ? 'page-title mb-0' : (isCartoon ? 'page-title mb-2' : 'page-title mb-0')}>
                      {displayStock.name}
                    </h1>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: isCartoon ? 8 : 13, color: 'var(--color-text-secondary)' }}>
                      {displayStock.code} · {displayStock.market === 'SH' ? '上证' : '深证'}
                    </span>
                  </div>
                  {/* Price hero */}
                  <div className="flex items-end gap-4 mt-3">
                    <span
                      style={{
                        fontFamily: isCartoon ? 'var(--font-mono)' : 'var(--font-mono)',
                        fontSize: isCartoon ? 12 : 36,
                        fontWeight: 700,
                        color: isUp(displayStock) ? 'var(--color-up)' : 'var(--color-down)',
                      }}
                    >
                      {fmt(displayStock.realtime?.price)}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: isCartoon ? 8 : 16,
                        color: isUp(displayStock) ? 'var(--color-up)' : 'var(--color-down)',
                        marginBottom: isCartoon ? 2 : 4,
                      }}
                    >
                      {isUp(displayStock) ? '▲' : '▼'} {isUp(displayStock) ? '+' : ''}{fmt(displayStock.realtime?.change)} ({isUp(displayStock) ? '+' : ''}{fmt(displayStock.realtime?.changePct)}%)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Chart */}
            <div className={`${cardClass} p-4 mb-6`} style={isCartoon ? { boxShadow: '4px 4px 0px var(--color-border)' } : (isFinancial ? { backdropFilter: 'blur(12px)' } : { borderTop: '4px solid var(--color-border)' })}>
              {loading ? (
                <StatsSkeleton />
              ) : (
                <KLineChart data={historyData} height={isMinimal ? 300 : 450} />
              )}
            </div>

            {/* Stats grid */}
            <div className={`${isMinimal ? 'swiss-grid' : 'grid grid-cols-4 gap-4'}`}>
              {[
                { label: '开盘', value: fmt(displayStock.realtime?.open) },
                { label: '昨收', value: fmt(displayStock.realtime?.prevClose) },
                { label: '最高', value: fmt(displayStock.realtime?.high), up: true },
                { label: '最低', value: fmt(displayStock.realtime?.low), down: true },
                { label: '成交量', value: (displayStock.realtime?.volume ? (displayStock.realtime.volume / 100000000).toFixed(2) + '亿' : '--') },
                { label: '成交额', value: (displayStock.realtime?.amount ? (displayStock.realtime.amount / 100000000).toFixed(2) + '亿' : '--') },
                { label: '涨跌额', value: `${isUp(displayStock) ? '+' : ''}${fmt(displayStock.realtime?.change)}`, up: isUp(displayStock), down: !isUp(displayStock) },
                { label: '涨跌幅', value: `${isUp(displayStock) ? '+' : ''}${fmt(displayStock.realtime?.changePct)}%`, up: isUp(displayStock), down: !isUp(displayStock) },
              ].map((item) => (
                <div
                  key={item.label}
                  className={isCartoon ? 'pixel-card p-3' : ''}
                  style={isCartoon ? { boxShadow: '2px 2px 0px var(--color-border)' } : (isMinimal ? { padding: '16px' } : { padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 4, border: '1px solid var(--color-border)' })}
                >
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: isCartoon ? 6 : (isMinimal ? 10 : 11), color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: isCartoon ? 8 : (isMinimal ? 14 : 16),
                      fontWeight: isCartoon ? 400 : 600,
                      color: item.up ? 'var(--color-up)' : (item.down ? 'var(--color-down)' : 'var(--color-text)'),
                    }}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Extended fields */}
            <div className={`${isMinimal ? 'swiss-grid mt-4' : 'grid grid-cols-4 gap-4 mt-4'}`}>
              {[
                { label: '换手率', value: displayStock.realtime?.turnoverRate ? `${displayStock.realtime.turnoverRate.toFixed(2)}%` : '--' },
                { label: '市盈率', value: displayStock.realtime?.pe ? displayStock.realtime.pe.toFixed(2) : '--' },
                { label: '市净率', value: displayStock.realtime?.pb ? displayStock.realtime.pb.toFixed(2) : '--' },
                { label: '总市值', value: displayStock.realtime?.marketCap ? formatMarketCap(displayStock.realtime.marketCap) : '--' },
                { label: '流通市值', value: displayStock.realtime?.floatMarketCap ? formatMarketCap(displayStock.realtime.floatMarketCap) : '--' },
                { label: '振幅', value: displayStock.realtime?.amplitude ? `${displayStock.realtime.amplitude.toFixed(2)}%` : '--' },
              ].map((item) => (
                <div
                  key={item.label}
                  className={isCartoon ? 'pixel-card p-3' : ''}
                  style={isCartoon ? { boxShadow: '2px 2px 0px var(--color-border)' } : (isMinimal ? { padding: '16px' } : { padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 4, border: '1px solid var(--color-border)' })}
                >
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: isCartoon ? 6 : (isMinimal ? 10 : 11), color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: isCartoon ? 8 : (isMinimal ? 14 : 16),
                      fontWeight: isCartoon ? 400 : 600,
                      color: 'var(--color-text)',
                    }}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* BidAsk Panel */}
            <div className="mt-4">
              <BidAskPanel bidAsk={bidAsk} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-text-secondary)' }}>
            <div className="text-center">
              <div style={{ fontSize: isCartoon ? 16 : 48, marginBottom: 8, opacity: 0.3 }}>
                {isCartoon ? '★' : (isMinimal ? '·' : '◉')}
              </div>
              <div style={{ fontFamily: isCartoon ? 'var(--font-heading)' : 'var(--font-body)', fontSize: isCartoon ? 8 : 14 }}>
                请选择一只股票查看详情
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}