import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { KLineChart } from '../components/charts/KLineChart';
import { useTheme } from '../theme/ThemeContext';
import { RealtimeData } from '../services/marketApi';
import { useRealtimeSSE } from '../hooks/useRealtimeSSE';
import { useBidAsk } from '../hooks/useBidAsk';
import { BidAskPanel } from '../components/market/BidAskPanel';

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
  const { data: realtimeMap } = useRealtimeSSE(stockCodes);

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
        {/* Search */}
        <div className="p-3" style={{ borderBottom: isCartoon ? '3px solid var(--color-border)' : '1px solid var(--color-border)' }}>
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

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {stocks.map((stock) => {
            const active = selectedCode === stock.code;
            const realtime = realtimeMap.get(stock.code) || stock.realtime;
            const up = realtime?.changePct != null && realtime.changePct >= 0;
            return (
              <div
                key={stock.code}
                onClick={() => setSearchParams({ code: stock.code })}
                className="cursor-pointer transition-all duration-150"
                style={{
                  padding: isCartoon ? '10px 12px' : isMinimal ? '16px 8px' : '12px 16px',
                  borderBottom: isCartoon ? '2px solid rgba(255,215,0,0.15)' : (isMinimal ? '1px solid #E5E5E5' : '1px solid var(--color-border)'),
                  backgroundColor: active
                    ? (isCartoon ? 'rgba(255,215,0,0.2)' : (isMinimal ? 'var(--color-surface)' : 'rgba(59,130,246,0.12)'))
                    : 'transparent',
                  borderLeft: active && isFinancial ? '3px solid var(--color-primary)' : (active && isCartoon ? '3px solid var(--color-primary)' : 'none'),
                }}
              >
                <div className="flex justify-between items-center">
                  <span
                    style={{
                      fontFamily: isCartoon ? 'var(--font-heading)' : (isMinimal ? 'var(--font-heading)' : 'var(--font-body)'),
                      fontSize: isCartoon ? 8 : (isMinimal ? 18 : 14),
                      fontWeight: isMinimal ? 400 : 600,
                      color: 'var(--color-text)',
                      letterSpacing: isMinimal ? '0.1em' : undefined,
                    }}
                  >
                    {isMinimal ? stock.code : stock.name}
                  </span>
                  {isCartoon ? (
                    <span className="price-tag" style={{ color: up ? 'var(--color-up)' : 'var(--color-down)', borderColor: 'var(--color-border)' }}>
                      {up ? '+' : ''}{fmt(realtime?.changePct)}%
                    </span>
                  ) : isMinimal ? (
                    <span className="mono" style={{ fontSize: 12, color: up ? 'var(--color-up)' : 'var(--color-down)', fontWeight: 500 }}>
                      {up ? '+' : ''}{fmt(realtime?.changePct)}%
                    </span>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: up ? 'var(--color-up)' : 'var(--color-down)', fontWeight: 600 }}>
                      {up ? '+' : ''}{fmt(realtime?.price)}
                    </span>
                  )}
                </div>
                {!isMinimal && (
                  <div className="flex justify-between items-center mt-1">
                    {isCartoon ? (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--color-primary)' }}>
                        {stock.code}
                      </span>
                    ) : (
                      <>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                          {stock.code}
                        </span>
                        <span
                          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: up ? 'var(--color-up)' : 'var(--color-down)', padding: '1px 6px', borderRadius: 2, background: up ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)' }}
                        >
                          {up ? '+' : ''}{fmt(realtime?.changePct)}%
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Detail */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--color-background)' }}>
        {selectedStock ? (
          <div className="p-6">
            {/* Header */}
            <div className="mb-6">
              {isMinimal ? (
                <div>
                  <div className="page-title">{selectedStock.code}</div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 48, letterSpacing: '0.05em', color: 'var(--color-text)', lineHeight: 1 }}>
                    {selectedStock.name}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline gap-3">
                    <h1 className={isFinancial ? 'page-title mb-0' : (isCartoon ? 'page-title mb-2' : 'page-title mb-0')}>
                      {selectedStock.name}
                    </h1>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: isCartoon ? 8 : 13, color: 'var(--color-text-secondary)' }}>
                      {selectedStock.code} · {selectedStock.market === 'SH' ? '上证' : '深证'}
                    </span>
                  </div>
                  {/* Price hero */}
                  <div className="flex items-end gap-4 mt-3">
                    <span
                      style={{
                        fontFamily: isCartoon ? 'var(--font-mono)' : 'var(--font-mono)',
                        fontSize: isCartoon ? 12 : 36,
                        fontWeight: 700,
                        color: isUp(selectedStock) ? 'var(--color-up)' : 'var(--color-down)',
                      }}
                    >
                      {fmt(selectedStock.realtime?.price)}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: isCartoon ? 8 : 16,
                        color: isUp(selectedStock) ? 'var(--color-up)' : 'var(--color-down)',
                        marginBottom: isCartoon ? 2 : 4,
                      }}
                    >
                      {isUp(selectedStock) ? '▲' : '▼'} {isUp(selectedStock) ? '+' : ''}{fmt(selectedStock.realtime?.change)} ({isUp(selectedStock) ? '+' : ''}{fmt(selectedStock.realtime?.changePct)}%)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Chart */}
            <div className={`${cardClass} p-4 mb-6`} style={isCartoon ? { boxShadow: '4px 4px 0px var(--color-border)' } : (isFinancial ? { backdropFilter: 'blur(12px)' } : { borderTop: '4px solid var(--color-border)' })}>
              {loading ? (
                <div className="flex items-center justify-center" style={{ height: isMinimal ? 300 : 450, color: 'var(--color-text-secondary)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>加载中...</span>
                </div>
              ) : (
                <KLineChart data={historyData} height={isMinimal ? 300 : 450} />
              )}
            </div>

            {/* Stats grid */}
            <div className={`${isMinimal ? 'swiss-grid' : 'grid grid-cols-4 gap-4'}`}>
              {[
                { label: '开盘', value: fmt(selectedStock.realtime?.open) },
                { label: '昨收', value: fmt(selectedStock.realtime?.prevClose) },
                { label: '最高', value: fmt(selectedStock.realtime?.high), up: true },
                { label: '最低', value: fmt(selectedStock.realtime?.low), down: true },
                { label: '成交量', value: (selectedStock.realtime?.volume ? (selectedStock.realtime.volume / 100000000).toFixed(2) + '亿' : '--') },
                { label: '成交额', value: (selectedStock.realtime?.amount ? (selectedStock.realtime.amount / 100000000).toFixed(2) + '亿' : '--') },
                { label: '涨跌额', value: `${isUp(selectedStock) ? '+' : ''}${fmt(selectedStock.realtime?.change)}`, up: isUp(selectedStock), down: !isUp(selectedStock) },
                { label: '涨跌幅', value: `${isUp(selectedStock) ? '+' : ''}${fmt(selectedStock.realtime?.changePct)}%`, up: isUp(selectedStock), down: !isUp(selectedStock) },
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
                { label: '换手率', value: selectedStock.realtime?.turnoverRate ? `${selectedStock.realtime.turnoverRate.toFixed(2)}%` : '--' },
                { label: '市盈率', value: selectedStock.realtime?.pe ? selectedStock.realtime.pe.toFixed(2) : '--' },
                { label: '市净率', value: selectedStock.realtime?.pb ? selectedStock.realtime.pb.toFixed(2) : '--' },
                { label: '总市值', value: selectedStock.realtime?.marketCap ? formatMarketCap(selectedStock.realtime.marketCap) : '--' },
                { label: '流通市值', value: selectedStock.realtime?.floatMarketCap ? formatMarketCap(selectedStock.realtime.floatMarketCap) : '--' },
                { label: '振幅', value: selectedStock.realtime?.amplitude ? `${selectedStock.realtime.amplitude.toFixed(2)}%` : '--' },
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