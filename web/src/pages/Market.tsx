import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { KLineChart } from '../components/charts/KLineChart';

interface Stock {
  code: string;
  name: string;
  market: string;
  industry?: string;
  realtime?: {
    price: number;
    change: number;
    changePct: number;
    high: number;
    low: number;
    open: number;
    prevClose: number;
    volume: number;
    amount: number;
  };
}

interface HistoryData {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

export function Market() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCode = searchParams.get('code');

  const [stocks, setStocks] = useState<Stock[]>([]);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [historyData, setHistoryData] = useState<HistoryData[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStocks = async () => {
      const params = new URLSearchParams();
      if (keyword) params.set('keyword', keyword);
      params.set('pageSize', '100');

      const res = await fetch(`/api/v1/market/stocks?${params}`);
      const json = await res.json();
      setStocks(json.data?.items || []);
    };
    fetchStocks();
  }, [keyword]);

  useEffect(() => {
    if (!selectedCode) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [stockRes, historyRes] = await Promise.all([
          fetch(`/api/v1/market/stocks/${selectedCode}`),
          fetch(`/api/v1/market/history/${selectedCode}`),
        ]);

        const stockJson = await stockRes.json();
        const historyJson = await historyRes.json();

        setSelectedStock(stockJson.data);
        setHistoryData(historyJson.data || []);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedCode]);

  const handleSelectStock = (code: string) => {
    setSearchParams({ code });
  };

  const fmt = (n: number | undefined, d = 2) =>
    n != null ? n.toFixed(d) : '--';

  const isUp = (stock: Stock | null) =>
    stock?.realtime?.changePct != null && stock.realtime.changePct >= 0;

  return (
    <div className="flex h-full" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}>
      {/* 左侧股票列表 */}
      <div
        className="w-80 flex flex-col"
        style={{ backgroundColor: 'var(--color-surface)', borderRight: '1px solid var(--color-border)' }}
      >
        <div className="p-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <input
            type="text"
            placeholder="搜索股票代码或名称..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full px-3 py-2 border rounded text-sm"
            style={{
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text)',
              borderColor: 'var(--color-border)',
            }}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {stocks.map((stock) => (
            <div
              key={stock.code}
              onClick={() => handleSelectStock(stock.code)}
              className="p-3 cursor-pointer transition-colors duration-150"
              style={{
                borderBottom: '1px solid var(--color-border)',
                backgroundColor: selectedCode === stock.code ? 'var(--color-primary)' + '20' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (selectedCode !== stock.code) {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.08)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedCode !== stock.code) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
                  {stock.name}
                </span>
                <span
                  className="text-xs font-mono"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {stock.code}
                </span>
              </div>
              {stock.realtime && (
                <div className="flex justify-between items-center mt-1">
                  <span
                    className="text-sm font-bold"
                    style={{ color: isUp(stock) ? 'var(--color-up)' : 'var(--color-down)' }}
                  >
                    {fmt(stock.realtime.price)}
                  </span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded font-mono"
                    style={{
                      color: '#fff',
                      backgroundColor: isUp(stock) ? 'var(--color-up)' : 'var(--color-down)',
                    }}
                  >
                    {isUp(stock) ? '+' : ''}{fmt(stock.realtime.changePct)}%
                  </span>
                </div>
              )}
            </div>
          ))}
          {stocks.length === 0 && (
            <div className="p-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>
              暂无数据
            </div>
          )}
        </div>
      </div>

      {/* 右侧详情 */}
      <div className="flex-1 flex flex-col overflow-y-auto" style={{ backgroundColor: 'var(--color-background)' }}>
        {selectedStock ? (
          <div className="p-6">
            {/* 头部信息 */}
            <div className="mb-6">
              <div className="flex items-baseline gap-3">
                <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                  {selectedStock.name}
                </h1>
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {selectedStock.code} · {selectedStock.market === 'SH' ? '上证' : '深证'}
                </span>
              </div>
              {selectedStock.industry && (
                <span
                  className="inline-block mt-1 text-xs px-2 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)' }}
                >
                  {selectedStock.industry}
                </span>
              )}
            </div>

            {/* K线图 */}
            {loading ? (
              <div
                className="flex items-center justify-center rounded"
                style={{ height: '500px', backgroundColor: 'var(--color-surface)' }}
              >
                <span style={{ color: 'var(--color-text-secondary)' }}>加载中...</span>
              </div>
            ) : (
              <div
                className="rounded p-4 mb-6"
                style={{ backgroundColor: 'var(--color-surface)' }}
              >
                <KLineChart data={historyData} height={450} />
              </div>
            )}

            {/* 行情数据 */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: '最新价', value: fmt(selectedStock.realtime?.price), up: isUp(selectedStock) },
                { label: '涨跌幅', value: `${isUp(selectedStock) ? '+' : ''}${fmt(selectedStock.realtime?.changePct)}%`, up: isUp(selectedStock) },
                { label: '涨跌额', value: `${isUp(selectedStock) ? '+' : ''}${fmt(selectedStock.realtime?.change)}`, up: isUp(selectedStock) },
                { label: '今开', value: fmt(selectedStock.realtime?.open) },
                { label: '昨收', value: fmt(selectedStock.realtime?.prevClose) },
                { label: '最高', value: fmt(selectedStock.realtime?.high) },
                { label: '最低', value: fmt(selectedStock.realtime?.low) },
                { label: '成交量', value: fmt(selectedStock.realtime?.volume, 0) + ' 股' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="p-4 rounded"
                  style={{ backgroundColor: 'var(--color-surface)' }}
                >
                  <div className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                    {item.label}
                  </div>
                  <div
                    className="text-lg font-bold font-mono"
                    style={{ color: item.up !== undefined ? (item.up ? 'var(--color-up)' : 'var(--color-down)') : 'var(--color-text)' }}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="flex-1 flex items-center justify-center"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <div className="text-center">
              <div className="text-4xl mb-2">📈</div>
              <div>请选择一只股票查看详情</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
