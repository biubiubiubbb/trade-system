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
      changePct: parseFloat(r['涨跌幅']) || 0,
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

  // === 超跌股池（使用强势股池接口获取跌幅大的）===
  async fetchBrokenStocks(date: string): Promise<import('../types').SystemLimitUpStock[]> {
    // 尝试调用强势股池接口并过滤跌幅大的股票
    const df = await this.client.get('/api/public/stock_zt_pool_strong_em', { params: { date } }).then(r => r.data as AktoolsDataFrame).catch(() => null);
    if (!df) return [];

    return this.dfToObjects<any>(df)
      .filter((r) => parseFloat(r['涨跌幅']) <= -5) // 跌幅超过5%
      .map((r) => ({
        code: r['代码'] || '',
        name: r['名称'] || '',
        changePct: parseFloat(r['涨跌幅']) || 0,
        price: parseFloat(r['最新价']) || 0,
        amount: parseFloat(r['成交额']) || 0,
        floatMarketCap: parseFloat(r['流通市值']) || 0,
        totalMarketCap: parseFloat(r['总市值']) || 0,
        turnoverRate: parseFloat(r['换手率']) || 0,
        industry: r['所属行业'] || '',
      }));
  }

  // === 概念板块指数历史（stock_board_concept_index_ths）===
  async fetchConceptBoardIndex(params: { name: string; startDate: string; endDate: string }): Promise<import('../types').SystemConceptBoardIndex[]> {
    const df = await this.client.get('/api/public/stock_board_concept_index_ths', {
      params: { symbol: params.name, start_date: params.startDate, end_date: params.endDate },
    }).then(r => r.data as AktoolsDataFrame).catch(() => null);

    if (!df) return [];
    return this.dfToObjects<any>(df).map((r) => ({
      date: new Date(r['日期']),
      open: parseFloat(r['开盘价']) || 0,
      high: parseFloat(r['最高价']) || 0,
      low: parseFloat(r['最低价']) || 0,
      close: parseFloat(r['收盘价']) || 0,
      volume: parseFloat(r['成交量']) || 0,
      amount: parseFloat(r['成交额']) || 0,
    }));
  }

  // === 概念板块详情（stock_board_concept_info_ths）===
  async fetchConceptBoardInfo(name: string): Promise<import('../types').SystemConceptBoardInfo | null> {
    const df = await this.client.get('/api/public/stock_board_concept_info_ths', {
      params: { symbol: name },
    }).then(r => r.data as AktoolsDataFrame).catch(() => null);

    if (!df) return null;
    const rows = this.dfToObjects<any>(df);
    const info: any = {};
    rows.forEach((r) => { info[r['项目']] = r['值']; });

    return {
      open: parseFloat(info['今开']) || undefined,
      prevClose: parseFloat(info['昨收']) || undefined,
      low: parseFloat(info['最低']) || undefined,
      high: parseFloat(info['最高']) || undefined,
      volume: parseFloat(info['成交量(万手)']) || undefined,
      changePct: info['板块涨幅'] || undefined,
      changeRank: info['涨幅排名'] || undefined,
      riseFallCount: info['涨跌家数'] || undefined,
      netInflow: parseFloat(info['资金净流入(亿)']) || undefined,
      amount: parseFloat(info['成交额(亿)']) || undefined,
    };
  }

  // === 行业板块指数历史（stock_board_industry_index_ths）===
  async fetchIndustryBoardIndex(params: { name: string; startDate: string; endDate: string }): Promise<import('../types').SystemIndustryBoardIndex[]> {
    const df = await this.client.get('/api/public/stock_board_industry_index_ths', {
      params: { symbol: params.name, start_date: params.startDate, end_date: params.endDate },
    }).then(r => r.data as AktoolsDataFrame).catch(() => null);

    if (!df) return [];
    return this.dfToObjects<any>(df).map((r) => ({
      date: new Date(r['日期']),
      open: parseFloat(r['开盘价']) || 0,
      high: parseFloat(r['最高价']) || 0,
      low: parseFloat(r['最低价']) || 0,
      close: parseFloat(r['收盘价']) || 0,
      volume: parseFloat(r['成交量']) || 0,
      amount: parseFloat(r['成交额']) || 0,
    }));
  }

  // === 昨日涨停股池（stock_zt_pool_previous_em）===
  async fetchPreviousLimitUpPool(date: string): Promise<import('../types').SystemPreviousLimitUp[]> {
    const df = await this.client.get('/api/public/stock_zt_pool_previous_em', { params: { date } }).then(r => r.data as AktoolsDataFrame).catch(() => null);
    if (!df) return [];

    return this.dfToObjects<any>(df).map((r) => ({
      code: r['代码'] || '',
      name: r['名称'] || '',
      changePct: parseFloat(r['涨跌幅']) || 0,
      price: parseFloat(r['最新价']) || 0,
      limitUpPrice: parseFloat(r['涨停价']) || 0,
      amount: parseFloat(r['成交额']) || 0,
      floatMarketCap: parseFloat(r['流通市值']) || 0,
      totalMarketCap: parseFloat(r['总市值']) || 0,
      turnoverRate: parseFloat(r['换手率']) || 0,
      speed: parseFloat(r['涨速']) || 0,
      amplitude: parseFloat(r['振幅']) || 0,
      lastSealTime: r['昨日封板时间'] || '',
      lastBoardCount: parseInt(r['昨日连板数']) || 0,
      sealStat: r['涨停统计'] || '',
      industry: r['所属行业'] || '',
    }));
  }

  // === 次新股池（stock_zt_pool_sub_new_em）===
  async fetchSubNewPool(date: string): Promise<import('../types').SystemSubNewStock[]> {
    const df = await this.client.get('/api/public/stock_zt_pool_sub_new_em', { params: { date } }).then(r => r.data as AktoolsDataFrame).catch(() => null);
    if (!df) return [];

    return this.dfToObjects<any>(df).map((r) => ({
      code: r['代码'] || '',
      name: r['名称'] || '',
      changePct: parseFloat(r['涨跌幅']) || 0,
      price: parseFloat(r['最新价']) || 0,
      limitUpPrice: parseFloat(r['涨停价']) || 0,
      amount: parseFloat(r['成交额']) || 0,
      floatMarketCap: parseFloat(r['流通市值']) || 0,
      totalMarketCap: parseFloat(r['总市值']) || 0,
      turnoverRate: parseFloat(r['转手率']) || 0,
      openBoardDays: parseInt(r['开板几日']) || 0,
      openBoardDate: r['开板日期'] || '',
      listDate: r['上市日期'] || '',
      isNewHigh: r['是否新高'] === '是',
      sealStat: r['涨停统计'] || '',
      industry: r['所属行业'] || '',
    }));
  }

  // === 炸板股池（stock_zt_pool_zbgc_em）===
  async fetchBrokenLimitUpPool(date: string): Promise<import('../types').SystemBrokenLimitUp[]> {
    const df = await this.client.get('/api/public/stock_zt_pool_zbgc_em', { params: { date } }).then(r => r.data as AktoolsDataFrame).catch(() => null);
    if (!df) return [];

    return this.dfToObjects<any>(df).map((r) => ({
      code: r['代码'] || '',
      name: r['名称'] || '',
      changePct: parseFloat(r['涨跌幅']) || 0,
      price: parseFloat(r['最新价']) || 0,
      limitUpPrice: parseFloat(r['涨停价']) || 0,
      amount: parseFloat(r['成交额']) || 0,
      floatMarketCap: parseFloat(r['流通市值']) || 0,
      totalMarketCap: parseFloat(r['总市值']) || 0,
      turnoverRate: parseFloat(r['换手率']) || 0,
      speed: parseFloat(r['涨速']) || 0,
      firstSealTime: r['首次封板时间'] || '',
      brokenCount: parseInt(r['炸板次数']) || 0,
      sealStat: parseInt(r['涨停统计']) || 0,
      amplitude: parseFloat(r['振幅']) || 0,
      industry: r['所属行业'] || '',
    }));
  }

  // === 跌停股池（stock_zt_pool_dtgc_em）===
  async fetchLimitDownPoolEm(date: string): Promise<import('../types').SystemLimitDownStock[]> {
    const df = await this.client.get('/api/public/stock_zt_pool_dtgc_em', { params: { date } }).then(r => r.data as AktoolsDataFrame).catch(() => null);
    if (!df) return [];

    return this.dfToObjects<any>(df).map((r) => ({
      code: r['代码'] || '',
      name: r['名称'] || '',
      changePct: parseFloat(r['涨跌幅']) || 0,
      price: parseFloat(r['最新价']) || 0,
      amount: parseFloat(r['成交额']) || 0,
      floatMarketCap: parseFloat(r['流通市值']) || 0,
      totalMarketCap: parseFloat(r['总市值']) || 0,
      turnoverRate: parseFloat(r['换手率']) || 0,
      pe: parseFloat(r['动态市盈率']) || 0,
      volumeRatio: parseFloat(r['量比']) || undefined,
      bid1: parseFloat(r['买一']) || undefined,
      ask1: parseFloat(r['卖一']) || undefined,
      amplitude: parseFloat(r['振幅']) || 0,
      industry: r['所属行业'] || '',
    }));
  }

  // === 创业板行情（stock_cy_a_spot_em）- 从全量中过滤 ===
  async fetchCyASpot(): Promise<import('../types').SystemRealtime[]> {
    const all = await this.fetchRealtime([]);
    return all.filter(r => r.code.startsWith('300') || r.code.startsWith('301'));
  }

  // === 科创板行情（stock_kc_a_spot_em）- 从全量中过滤 ===
  async fetchKcASpot(): Promise<import('../types').SystemRealtime[]> {
    const all = await this.fetchRealtime([]);
    return all.filter(r => r.code.startsWith('688'));
  }

  // === 新浪实时行情（stock_zh_a_spot）- 备用 ===
  async fetchSinaSpot(): Promise<import('../types').SystemRealtime[]> {
    const df = await this.client.get('/api/public/stock_zh_a_spot').then(r => r.data as AktoolsDataFrame).catch(() => null);
    if (!df) return [];
    return this.dfToObjects<any>(df).map((r) => ({
      code: (r['代码'] || '').replace(/^(sz|sh|bj)/i, ''),
      name: r['名称'] || '',
      price: parseFloat(r['最新价']) || 0,
      change: parseFloat(r['涨跌额']) || 0,
      changePct: parseFloat(r['涨跌幅']) || 0,
      volume: parseFloat(r['成交量']) || 0,
      amount: parseFloat(r['成交额']) || 0,
      open: parseFloat(r['今开']) || 0,
      prevClose: parseFloat(r['昨收']) || 0,
      high: parseFloat(r['最高']) || 0,
      low: parseFloat(r['最低']) || 0,
      updatedAt: new Date(),
    }));
  }

  // === 雪球行情（stock_individual_spot_xq）- 备用 ===
  async fetchXueqiuSpot(code: string): Promise<import('../types').SystemRealtime | null> {
    const df = await this.client.get('/api/public/stock_individual_spot_xq', { params: { symbol: code } }).then(r => r.data as AktoolsDataFrame).catch(() => null);
    if (!df) return null;
    const rows = this.dfToObjects<any>(df);
    const info: any = {};
    rows.forEach((r) => { info[r['item']] = r['value']; });

    return {
      code: code,
      name: info['名称'] || '',
      price: parseFloat(info['现价']) || 0,
      change: parseFloat(info['涨跌']) || 0,
      changePct: parseFloat(info['涨幅']) || 0,
      volume: parseFloat(info['成交量']) || 0,
      amount: parseFloat(info['成交额']) || 0,
      open: parseFloat(info['今开']) || 0,
      prevClose: parseFloat(info['昨收']) || 0,
      high: parseFloat(info['最高']) || 0,
      low: parseFloat(info['最低']) || 0,
      amplitude: parseFloat(info['振幅']) || 0,
      turnoverRate: parseFloat(info['周转率']) || 0,
      pe: parseFloat(info['市盈率(动)']) || 0,
      pb: parseFloat(info['市净率']) || 0,
      marketCap: parseFloat(info['资产净值/总市值']) || 0,
      floatMarketCap: parseFloat(info['流通值']) || 0,
      updatedAt: new Date(),
    };
  }
}
