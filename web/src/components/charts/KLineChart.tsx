import { useEffect, useRef, useCallback } from 'react';
import { createChart, IChartApi, CandlestickData, HistogramData, Time, ColorType, LineStyle, CandlestickSeries, HistogramSeries } from 'lightweight-charts';

interface KLineData {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

interface KLineChartProps {
  data: KLineData[];
  height?: number;
}

function parseDate(dateStr: string): Time {
  return dateStr.split('T')[0].slice(0, 10) as Time;
}

export function KLineChart({ data, height = 400 }: KLineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const getColor = useCallback((varName: string, fallback: string): string => {
    if (typeof window === 'undefined') return fallback;
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback;
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const textColor = getColor('--color-text-secondary', '#94A3B8');
    const upColor = getColor('--color-up', '#EF4444');
    const downColor = getColor('--color-down', '#22C55E');
    const borderColor = getColor('--color-border', '#334155');

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: borderColor + '40' },
        horzLines: { color: borderColor + '40' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: upColor,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: upColor,
        },
        horzLine: {
          color: upColor,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: upColor,
        },
      },
      rightPriceScale: {
        borderColor,
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor,
      downColor,
      borderUpColor: upColor,
      borderDownColor: downColor,
      wickUpColor: upColor,
      wickDownColor: downColor,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    const candleData: CandlestickData<Time>[] = data.map((d) => ({
      time: parseDate(d.date),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumeData: HistogramData<Time>[] = data.map((d) => ({
      time: parseDate(d.date),
      value: d.volume,
      color: d.close >= d.open ? upColor + '60' : downColor + '60',
    }));

    candlestickSeries.setData(candleData);
    volumeSeries.setData(volumeData);
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [data, height, getColor]);

  return (
    <div
      ref={chartContainerRef}
      style={{ width: '100%', height: `${height}px`, borderRadius: 'var(--radius, 4px)' }}
    />
  );
}
