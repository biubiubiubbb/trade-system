import { useEffect, useRef } from 'react';
import { RealtimeData } from '../../services/marketApi';

interface Props {
  code: string;
  name: string;
  industry?: string;
  realtime?: RealtimeData;
  selected?: boolean;
  onClick?: () => void;
}

export function RealtimeTicker({ code, name, industry, realtime, selected, onClick }: Props) {
  const price = realtime?.price ?? 0;
  const changePct = realtime?.changePct ?? 0;
  const isUp = changePct >= 0;
  const priceRef = useRef<HTMLSpanElement>(null);
  const prevPriceRef = useRef<number>(0);

  // Price flash animation on SSE update
  useEffect(() => {
    if (price > 0 && price !== prevPriceRef.current && priceRef.current) {
      const flashClass = price > prevPriceRef.current ? 'price-flash-up' : 'price-flash-down';
      priceRef.current.classList.add(flashClass);
      setTimeout(() => {
        priceRef.current?.classList.remove(flashClass);
      }, 300);
    }
    prevPriceRef.current = price;
  }, [price]);

  return (
    <div
      className={`relative cursor-pointer transition-all duration-200 ${
        selected ? 'bg-blue-50/80' : 'hover:bg-gray-50/60'
      }`}
      onClick={onClick}
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--color-border)',
        borderLeft: selected ? '3px solid var(--color-primary)' : '3px solid transparent',
        transition: 'all 0.2s ease',
      }}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--color-text)',
              }}
              className="truncate"
            >
              {name}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--color-text-secondary)',
              }}
            >
              {code}
            </span>
            {industry && (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  color: 'var(--color-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                }}
              >
                {industry}
              </span>
            )}
          </div>
        </div>

        <div className="text-right ml-3">
          <span
            ref={priceRef}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 15,
              fontWeight: 700,
              color: isUp ? 'var(--color-up)' : 'var(--color-down)',
              transition: 'color 0.3s ease',
            }}
          >
            {price > 0 ? price.toFixed(2) : '--'}
          </span>
          <div
            className="flex items-center justify-end gap-1 mt-1"
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 500,
                padding: '2px 6px',
                borderRadius: 3,
                backgroundColor: isUp ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                color: isUp ? 'var(--color-up)' : 'var(--color-down)',
              }}
            >
              {changePct !== 0 ? `${isUp ? '+' : ''}${changePct.toFixed(2)}%` : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* Price change indicator bar */}
      {price > 0 && (
        <div
          className="absolute bottom-0 left-0 h-0.5 transition-all duration-300"
          style={{
            width: '100%',
            background: isUp
              ? 'linear-gradient(90deg, var(--color-up) 0%, transparent 100%)'
              : 'linear-gradient(90deg, transparent 0%, var(--color-down) 100%)',
            opacity: 0.6,
          }}
        />
      )}

      <style>{`
        @keyframes priceFlashUp {
          0% { background-color: rgba(239, 68, 68, 0.3); }
          100% { background-color: transparent; }
        }
        @keyframes priceFlashDown {
          0% { background-color: rgba(16, 185, 129, 0.3); }
          100% { background-color: transparent; }
        }
        .price-flash-up {
          animation: priceFlashUp 0.3s ease-out;
        }
        .price-flash-down {
          animation: priceFlashDown 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}