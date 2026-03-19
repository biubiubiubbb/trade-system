import { useEffect, useRef, useState } from 'react';
import { BidAsk } from '../../services/marketApi';

interface Props {
  bidAsk: BidAsk | null;
  loading?: boolean;
}

export function BidAskPanel({ bidAsk, loading }: Props) {
  const [flashing, setFlashing] = useState(false);
  const prevBidAskRef = useRef<BidAsk | null>(null);

  // Flash animation on data update
  useEffect(() => {
    if (bidAsk && prevBidAskRef.current !== bidAsk) {
      setFlashing(true);
      setTimeout(() => setFlashing(false), 200);
    }
    prevBidAskRef.current = bidAsk;
  }, [bidAsk]);

  if (loading) {
    return (
      <div
        className="rounded-lg p-4"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="animate-pulse flex justify-between">
          <div className="space-y-2 w-1/2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-5 bg-gray-200 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
            ))}
          </div>
          <div className="space-y-2 w-1/2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-5 bg-gray-200 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!bidAsk) return null;

  const bids = [bidAsk.bid1, bidAsk.bid2, bidAsk.bid3, bidAsk.bid4, bidAsk.bid5];
  const asks = [bidAsk.ask1, bidAsk.ask2, bidAsk.ask3, bidAsk.ask4, bidAsk.ask5];

  const maxVol = Math.max(
    ...bids.map(b => b.vol),
    ...asks.map(a => a.vol)
  );

  const formatVol = (vol: number) => {
    if (vol >= 1e8) return (vol / 1e8).toFixed(2) + '亿';
    if (vol >= 1e4) return (vol / 1e4).toFixed(2) + '万';
    return vol.toFixed(0);
  };

  // Calculate spread
  const bestBid = bids[0]?.price || 0;
  const bestAsk = asks[0]?.price || 0;
  const spread = bestAsk - bestBid;
  const spreadPct = bestBid > 0 ? (spread / bestBid) * 100 : 0;

  return (
    <div
      className={`rounded-lg overflow-hidden transition-all duration-200 ${flashing ? 'ring-2 ring-primary/30' : ''}`}
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{
          borderBottom: '1px solid var(--color-border)',
          background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.04) 0%, transparent 100%)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-text)',
          }}
        >
          五档盘口
        </span>
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--color-text-secondary)',
            }}
          >
            差值
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              color: spread > 0 ? 'var(--color-text)' : 'var(--color-text-secondary)',
            }}
          >
            {spread.toFixed(2)} ({spreadPct.toFixed(3)}%)
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-2 gap-3 p-4">
        {/* Sell orders (asks) - reversed to show highest at top */}
        <div className="space-y-1.5">
          <div
            className="text-xs pb-1 mb-1"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--color-down)',
              borderBottom: '1px dashed rgba(239, 68, 68, 0.3)',
            }}
          >
            卖盘 {asks.length}档
          </div>
          {[...asks].reverse().map((ask, i) => {
            const volRatio = ask.vol / maxVol;
            const idx = 4 - i; // reversed index
            return (
              <div key={`ask-${idx}`} className="relative group">
                {/* Volume bar */}
                <div
                  className="absolute right-0 top-0 bottom-0 rounded-l"
                  style={{
                    width: `${volRatio * 100}%`,
                    background: 'linear-gradient(90deg, transparent 0%, rgba(239, 68, 68, 0.15) 100%)',
                    minWidth: 2,
                  }}
                />
                <div className="relative flex justify-between items-center py-1">
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: 'var(--color-down)',
                      fontWeight: 500,
                    }}
                  >
                    {ask.price.toFixed(2)}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {formatVol(ask.vol)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Buy orders (bids) */}
        <div className="space-y-1.5">
          <div
            className="text-xs pb-1 mb-1"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--color-up)',
              borderBottom: '1px dashed rgba(16, 185, 129, 0.3)',
            }}
          >
            买盘 {bids.length}档
          </div>
          {bids.map((bid, i) => {
            const volRatio = bid.vol / maxVol;
            return (
              <div key={`bid-${i}`} className="relative group">
                {/* Volume bar */}
                <div
                  className="absolute right-0 top-0 bottom-0 rounded-l"
                  style={{
                    width: `${volRatio * 100}%`,
                    background: 'linear-gradient(90deg, transparent 0%, rgba(16, 185, 129, 0.15) 100%)',
                    minWidth: 2,
                  }}
                />
                <div className="relative flex justify-between items-center py-1">
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: 'var(--color-up)',
                      fontWeight: 500,
                    }}
                  >
                    {bid.price.toFixed(2)}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {formatVol(bid.vol)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Spread indicator */}
      <div
        className="px-4 py-2 text-center"
        style={{
          borderTop: '1px solid var(--color-border)',
          backgroundColor: 'rgba(59, 130, 246, 0.03)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--color-text-secondary)',
          }}
        >
          买卖价差:{' '}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 600,
            color: spread > 0.01 ? 'var(--color-text)' : 'var(--color-text-secondary)',
          }}
        >
          {spread.toFixed(2)} 元 ({spreadPct.toFixed(3)}%)
        </span>
      </div>
    </div>
  );
}