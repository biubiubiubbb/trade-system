import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

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

export function KLineChart({ data, height = 400 }: KLineChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts>();

  useEffect(() => {
    if (!chartRef.current) return;

    chartInstance.current = echarts.init(chartRef.current);

    const upColor = 'var(--color-up, #EF4444)';
    const downColor = 'var(--color-down, #22C55E)';

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      animation: true,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        borderColor: 'rgba(51, 65, 85, 0.8)',
        textStyle: { color: '#F1F5F9' },
      },
      grid: [
        { left: '10%', right: '8%', top: '10%', height: '50%' },
        { left: '10%', right: '8%', top: '65%', height: '20%' },
      ],
      xAxis: [
        {
          type: 'category',
          data: data.map((d) => d.date),
          gridIndex: 0,
          boundaryGap: false,
          axisLine: { lineStyle: { color: '#334155' } },
          axisLabel: { color: '#94A3B8', fontSize: 11 },
        },
        {
          type: 'category',
          data: data.map((d) => d.date),
          gridIndex: 1,
          boundaryGap: false,
          axisLine: { lineStyle: { color: '#334155' } },
          axisLabel: { color: '#94A3B8', fontSize: 11 },
        },
      ],
      yAxis: [
        {
          scale: true,
          gridIndex: 0,
          axisLine: { show: false },
          splitLine: { lineStyle: { color: '#1E293B' } },
          axisLabel: { color: '#94A3B8', fontSize: 11 },
        },
        {
          scale: true,
          gridIndex: 1,
          axisLine: { show: false },
          splitLine: { lineStyle: { color: '#1E293B' } },
          axisLabel: { color: '#94A3B8', fontSize: 11 },
        },
      ],
      series: [
        {
          name: 'K线',
          type: 'candlestick',
          data: data.map((d) => [d.open, d.close, d.low, d.high]),
          xAxisIndex: 0,
          yAxisIndex: 0,
          itemStyle: {
            color: upColor,
            color0: downColor,
            borderColor: upColor,
            borderColor0: downColor,
          },
        },
        {
          name: '成交量',
          type: 'bar',
          data: data.map((d) => ({
            value: d.volume,
            itemStyle: {
              color: d.close >= d.open ? `${upColor}80` : `${downColor}80`,
            },
          })),
          xAxisIndex: 1,
          yAxisIndex: 1,
        },
      ],
    };

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  }, [data]);

  return <div ref={chartRef} style={{ width: '100%', height: `${height}px` }} />;
}
