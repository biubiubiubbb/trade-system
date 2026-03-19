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