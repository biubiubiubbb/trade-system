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