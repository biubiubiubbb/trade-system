import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

interface AktoolsDataFrame {
  headers: string[];
  data: any[][];
}

@Injectable()
export class AktoolsAdapter {
  private readonly logger = new Logger(AktoolsAdapter.name);
  private readonly client: AxiosInstance;

  constructor() {
    // aktools 服务地址：Docker Compose 中服务名为 aktools
    const baseUrl = process.env.AKTOOLS_URL || 'http://aktools:8080';
    this.client = axios.create({ baseURL: baseUrl, timeout: 60000 });
  }

  isAvailable(): boolean { return true; }

  // 将 DataFrame 转为对象数组
  private dfToObjects<T>(df: AktoolsDataFrame): T[] {
    if (!df?.headers || !df?.data) return [];
    return df.data.map((row) => {
      const obj: any = {};
      df.headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj as T;
    });
  }

  // === 实时行情（stock_zh_a_spot_em）===
  async fetchRealtime(codes: string[]): Promise<import('../types').SystemRealtime[]> {
    const df = await this.client.get('/api/public/stock_zh_a_spot_em').then(r => r.data as AktoolsDataFrame);
    const rows = this.dfToObjects<any>(df);
    return rows.filter((r) => codes.includes(r['代码'])).map((r) => ({
      code: r['代码'] || '',
      name: r['名称'] || '',
      price: parseFloat(r['最新价']) || 0,
      change: parseFloat(r['涨跌额']) || 0,
      changePct: parseFloat(r['涨跌幅']) || 0,
      volume: parseFloat(r['成交量']) || 0,
      amount: parseFloat(r['成交额']) || 0,
      high: parseFloat(r['最高']) || 0,
      low: parseFloat(r['最低']) || 0,
      open: parseFloat(r['今开']) || 0,
      prevClose: parseFloat(r['昨收']) || 0,
      amplitude: parseFloat(r['振幅']) || 0,
      turnoverRate: parseFloat(r['换手率']) || 0,
      pe: parseFloat(r['市盈率-动态']) || 0,
      pb: parseFloat(r['市净率']) || 0,
      marketCap: parseFloat(r['总市值']) || 0,
      floatMarketCap: parseFloat(r['流通市值']) || 0,
      bidAsk: undefined,
      updatedAt: new Date(),
    }));
  }

  // === 买卖盘口（stock_bid_ask_em）===
  async fetchBidAsk(code: string): Promise<import('../types').SystemBidAsk | null> {
    const df = await this.client.get('/api/public/stock_bid_ask_em', { params: { symbol: code } }).then(r => r.data as AktoolsDataFrame);
    const rows = this.dfToObjects<any>(df);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      bid1: { price: parseFloat(r['买一']) || 0, vol: parseFloat(r['买一量']) || 0 },
      bid2: { price: parseFloat(r['买二']) || 0, vol: parseFloat(r['买二量']) || 0 },
      bid3: { price: parseFloat(r['买三']) || 0, vol: parseFloat(r['买三量']) || 0 },
      bid4: { price: parseFloat(r['买四']) || 0, vol: parseFloat(r['买四量']) || 0 },
      bid5: { price: parseFloat(r['买五']) || 0, vol: parseFloat(r['买五量']) || 0 },
      ask1: { price: parseFloat(r['卖一']) || 0, vol: parseFloat(r['卖一量']) || 0 },
      ask2: { price: parseFloat(r['卖二']) || 0, vol: parseFloat(r['卖二量']) || 0 },
      ask3: { price: parseFloat(r['卖三']) || 0, vol: parseFloat(r['卖三量']) || 0 },
      ask4: { price: parseFloat(r['卖四']) || 0, vol: parseFloat(r['卖四量']) || 0 },
      ask5: { price: parseFloat(r['卖五']) || 0, vol: parseFloat(r['卖五量']) || 0 },
    };
  }

  // === 历史行情（stock_zh_a_hist）===
  async fetchHistory(params: import('../types').HistoryParams): Promise<import('../types').SystemHistory[]> {
    const df = await this.client.get('/api/public/stock_zh_a_hist', {
      params: {
        symbol: params.code,
        period: 'daily',
        start_date: params.startDate,
        end_date: params.endDate,
        adjust: params.adjust === 'Forward' ? 'qfq' : params.adjust === 'Backward' ? 'hfq' : '',
      },
    }).then(r => r.data as AktoolsDataFrame);
    return this.dfToObjects<any>(df).map((r) => ({
      code: params.code,
      date: new Date(r['日期']),
      open: parseFloat(r['开盘']) || 0,
      close: parseFloat(r['收盘']) || 0,
      high: parseFloat(r['最高']) || 0,
      low: parseFloat(r['最低']) || 0,
      volume: parseFloat(r['成交量']) || 0,
      amount: parseFloat(r['成交额']) || 0,
      turnover: parseFloat(r['换手率']) || 0,
      adjust: params.adjust ?? 'None',
    }));
  }

  // === 分时数据（stock_intraday_sina）===
  async fetchMinute(code: string): Promise<import('../types').SystemMinute[]> {
    const df = await this.client.get('/api/public/stock_intraday_sina', {
      params: { symbol: code },
    }).then(r => r.data as AktoolsDataFrame);
    return this.dfToObjects<any>(df).map((r) => ({
      time: r['时间'],
      price: parseFloat(r['当前价格']) || 0,
      volume: parseFloat(r['成交量']) || 0,
      amount: parseFloat(r['成交额']) || 0,
    }));
  }

  // === 行业板块（stock_board_industry_summary_ths）===
  async fetchIndustryBoard(): Promise<import('../types').SystemIndustryBoard[]> {
    const df = await this.client.get('/api/public/stock_board_industry_summary_ths').then(r => r.data as AktoolsDataFrame);
    return this.dfToObjects<any>(df).map((r) => ({
      name: r['板块名称'] || '',
      changePct: parseFloat(r['涨跌幅']) || 0,
      volume: parseFloat(r['成交量']) || 0,
      amount: parseFloat(r['成交额']) || 0,
      netInflow: parseFloat(r['主力净流入']) || 0,
      riseCount: parseInt(r['上涨数']) || 0,
      fallCount: parseInt(r['下跌数']) || 0,
      leaderStock: r['领涨股票'] || '',
      leaderStockPrice: parseFloat(r['领涨股票最新价']) || 0,
      leaderStockChangePct: parseFloat(r['领涨股票涨跌幅']) || 0,
    }));
  }

  // === 概念板块（stock_board_concept_ths）===
  async fetchConceptBoard(): Promise<import('../types').SystemConceptBoard[]> {
    const df = await this.client.get('/api/public/stock_board_concept_ths').then(r => r.data as AktoolsDataFrame);
    return this.dfToObjects<any>(df).map((r) => ({
      name: r['板块名称'] || '',
      changePct: parseFloat(r['涨跌幅']) || 0,
      date: new Date(),
      open: 0, high: 0, low: 0, close: 0,
      volume: parseFloat(r['成交量']) || 0,
      amount: parseFloat(r['成交额']) || 0,
    }));
  }

  // === 涨停股池（stock_zt_pool_em）===
  async fetchLimitUpPool(date: string): Promise<import('../types').SystemLimitUpStock[]> {
    const df = await this.client.get('/api/public/stock_zt_pool_em', { params: { date } }).then(r => r.data as AktoolsDataFrame);
    return this.dfToObjects<any>(df).map((r) => ({
      code: r['代码'] || '',
      name: r['名称'] || '',
      changePxt: parseFloat(r['涨跌幅']) || 0,
      price: parseFloat(r['最新价']) || 0,
      amount: parseFloat(r['成交额']) || 0,
      floatMarketCap: parseFloat(r['流通市值']) || 0,
      totalMarketCap: parseFloat(r['总市值']) || 0,
      turnoverRate: parseFloat(r['换手率']) || 0,
      sealAmount: parseFloat(r['封单额']) || 0,
      firstSealTime: r['首次封板时间'] || undefined,
      lastSealTime: r['最后封板时间'] || undefined,
      brokenCount: parseInt(r['炸板次数']) || 0,
      continueBoard: parseInt(r['连板数']) || 0,
      industry: r['所属行业'] || '',
    }));
  }

  // === 跌停股池 ===
  async fetchLimitDownPool(date: string): Promise<import('../types').SystemLimitUpStock[]> {
    const df = await this.client.get('/api/public/stock_zt_pool_em', { params: { date } }).then(r => r.data as AktoolsDataFrame);
    return this.dfToObjects<any>(df)
      .filter((r) => parseFloat(r['涨跌幅']) <= -9.9)
      .map((r) => ({
        code: r['代码'] || '', name: r['名称'] || '',
        changePct: parseFloat(r['涨跌幅']) || 0,
        price: parseFloat(r['最新价']) || 0,
        amount: parseFloat(r['成交额']) || 0,
        floatMarketCap: parseFloat(r['流通市值']) || 0,
        totalMarketCap: parseFloat(r['总市值']) || 0,
        turnoverRate: parseFloat(r['换手率']) || 0,
        sealAmount: parseFloat(r['封单额']) || 0,
        continueBoard: 0, industry: r['所属行业'] || '',
      }));
  }

  // === 强势股池 ===
  async fetchStrongStocks(date: string): Promise<import('../types').SystemLimitUpStock[]> {
    try {
      const df = await this.client.get('/api/public/stock_zt_pool_strong_em', { params: { date } }).then(r => r.data as AktoolsDataFrame);
      return this.dfToObjects<any>(df).map((r) => ({
        code: r['代码'] || '', name: r['名称'] || '',
        changePct: parseFloat(r['涨跌幅']) || 0,
        price: parseFloat(r['最新价']) || 0,
        amount: parseFloat(r['成交额']) || 0,
        continueBoard: parseInt(r['连板数']) || 0,
        industry: r['所属行业'] || '',
      }));
    } catch { return []; }
  }

  // === 热搜（stock_hot_search_baidu）===
  async fetchHotStocks(params: import('../types').HotParams): Promise<import('../types').SystemHotStock[]> {
    const df = await this.client.get('/api/public/stock_hot_search_baidu', { params: { symbol: params.symbol || 'A股' } }).then(r => r.data as AktoolsDataFrame);
    return this.dfToObjects<any>(df).map((r) => ({
      name: r['股票名称'] || '', code: r['股票代码'] || '',
      changePct: r['涨跌幅'] || '0',
      heat: parseInt(r['热度']) || 0,
    }));
  }

  // === 股票列表（stock_zh_a_spot_em 全量）===
  async fetchStockList(): Promise<import('../types').SystemStock[]> {
    const df = await this.client.get('/api/public/stock_zh_a_spot_em').then(r => r.data as AktoolsDataFrame);
    return this.dfToObjects<any>(df).map((r) => ({
      code: r['代码'] || '',
      name: r['名称'] || '',
      market: (r['代码'] || '').startsWith('6') ? 'SH' : 'SZ',
      industry: r['所属行业'] || undefined,
    }));
  }

  // === 超跌股池 ===
  async fetchBrokenStocks(date: string): Promise<import('../types').SystemLimitUpStock[]> {
    this.logger.warn('fetchBrokenStocks not implemented - returning empty');
    return [];
  }
}
