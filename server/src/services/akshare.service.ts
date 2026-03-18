import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from './redis.service';

@Injectable()
export class AkshareService {
  private readonly logger = new Logger(AkshareService.name);
  private readonly client: AxiosInstance;
  private readonly delay: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    this.client = axios.create({ timeout: 30000 });
    this.delay = 1000;
  }

  async fetchStockList(): Promise<{ code: string; name: string; market: string }[]> {
    try {
      const response = await axios.get(
        'https://push2.eastmoney.com/api/qt/clist/get',
        {
          params: {
            pn: 1,
            pz: 5000,
            po: 1,
            np: 1,
            fltt: 2,
            invt: 2,
            fid: 'f3',
            fs: 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048',
            fields: 'f12,f14',
          },
        },
      );

      const data = response.data.data;
      if (!data?.diff) return [];

      return Object.values(data.diff).map((item: any) => ({
        code: item.f12,
        name: item.f14,
        market: item.f12.startsWith('6') ? 'SH' : 'SZ',
      }));
    } catch (error) {
      this.logger.error('Failed to fetch stock list', error);
      return [];
    }
  }

  async fetchHistoryData(
    code: string,
    startDate: string,
    endDate: string,
    adjust: 'None' | 'Forward' | 'Backward' = 'None',
  ): Promise<any[]> {
    try {
      const secid = code.startsWith('6') ? `1.${code}` : `0.${code}`;
      const adjustMap: Record<string, number> = { None: 0, Forward: 2, Backward: 1 };

      const response = await this.client.get(
        'https://push2his.eastmoney.com/api/qt/stock/kline/get',
        {
          params: {
            secid,
            fields1: 'f1,f2,f3,f4,f5,f6',
            fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
            klt: 101,
            fqt: adjustMap[adjust],
            beg: startDate.replace(/-/g, ''),
            end: endDate.replace(/-/g, ''),
            lmt: 1000000,
          },
        },
      );

      const data = response.data.data;
      if (!data?.klines) return [];

      return data.klines.map((line: string) => {
        const [date, open, close, high, low, volume, amount, _, _2, turnover] = line.split(',');
        return {
          code,
          date: new Date(date),
          open: parseFloat(open),
          close: parseFloat(close),
          high: parseFloat(high),
          low: parseFloat(low),
          volume: parseFloat(volume),
          amount: parseFloat(amount),
          turnover: turnover ? parseFloat(turnover) : null,
          adjust,
        };
      });
    } catch (error) {
      this.logger.error(`Failed to fetch history for ${code}`, error);
      return [];
    }
  }

  async fetchRealtimeData(codes: string[]): Promise<any[]> {
    try {
      const secids = codes
        .map((code) => (code.startsWith('6') ? `1.${code}` : `0.${code}`))
        .join(',');

      const response = await this.client.get(
        'https://push2.eastmoney.com/api/qt/ulist.np/get',
        {
          params: {
            fltt: 2,
            invt: 2,
            secids,
            fields: 'f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f14,f15,f16,f17,f18',
          },
        },
      );

      const data = response.data.data;
      if (!data?.diff) return [];

      return Object.values(data.diff).map((item: any) => ({
        code: item.f12,
        name: item.f14,
        price: item.f2,
        change: item.f3,
        changePct: item.f4,
        volume: item.f5,
        amount: item.f6,
        high: item.f15,
        low: item.f16,
        open: item.f17,
        prevClose: item.f18,
        bid1: item.f9 || item.f2,
        ask1: item.f10 || item.f2,
      }));
    } catch (error) {
      this.logger.error('Failed to fetch realtime data', error);
      return [];
    }
  }

  async fetchWithRetry<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T | null> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        this.logger.warn(`Fetch attempt ${i + 1} failed:`, error);
        if (i < maxRetries - 1) {
          await this.sleep(Math.pow(2, i) * this.delay);
        }
      }
    }
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
