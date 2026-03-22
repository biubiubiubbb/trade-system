const BASE_URL = '/api/v1/market';

export interface Stock {
  code: string;
  name: string;
  market: string;
  industry?: string;
  totalShares?: number;
  floatShares?: number;
  listDate?: string;
  realtime?: RealtimeData;
}

export interface BidAskLevel {
  price: number;
  vol: number;
}

export interface RealtimeData {
  code: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  amount: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  amplitude?: number;
  turnoverRate?: number;
  pe?: number;
  pb?: number;
  marketCap?: number;
  floatMarketCap?: number;
  updatedAt?: string;
  bidAsk?: {
    bid1: BidAskLevel;
    bid2: BidAskLevel;
    bid3: BidAskLevel;
    bid4: BidAskLevel;
    bid5: BidAskLevel;
    ask1: BidAskLevel;
    ask2: BidAskLevel;
    ask3: BidAskLevel;
    ask4: BidAskLevel;
    ask5: BidAskLevel;
  };
}

export interface BidAsk {
  bid1: BidAskLevel;
  bid2: BidAskLevel;
  bid3: BidAskLevel;
  bid4: BidAskLevel;
  bid5: BidAskLevel;
  ask1: BidAskLevel;
  ask2: BidAskLevel;
  ask3: BidAskLevel;
  ask4: BidAskLevel;
  ask5: BidAskLevel;
}

export interface HistoryData {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
}

export interface Sector {
  id: string;
  code: string;
  name: string;
  type: 'INDUSTRY' | 'CONCEPT';
  changePct?: number;
  volume?: number;
  amount?: number;
  netInflow?: number;
  riseCount?: number;
  fallCount?: number;
  leaderStock?: string;
  leaderStockPrice?: number;
  leaderStockChangePct?: number;
}

export interface LimitUpStock {
  code: string;
  name: string;
  changePct: number;
  price: number;
  amount: number;
  floatMarketCap?: number;
  totalMarketCap?: number;
  turnoverRate?: number;
  sealAmount?: number;
  continueBoard?: number;
  industry?: string;
  firstSealTime?: string;
  lastSealTime?: string;
  brokenCount?: number;
}

// 概念板块指数历史
export interface ConceptBoardIndex {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
}

// 概念板块详情
export interface ConceptBoardInfo {
  open?: number;
  prevClose?: number;
  low?: number;
  high?: number;
  volume?: number;
  changePct?: string;
  changeRank?: string;
  riseFallCount?: string;
  netInflow?: number;
  amount?: number;
}

// 行业板块指数历史
export interface IndustryBoardIndex {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
}

// 昨日涨停
export interface PreviousLimitUp {
  code: string;
  name: string;
  changePct: number;
  price: number;
  limitUpPrice: number;
  amount: number;
  floatMarketCap: number;
  totalMarketCap: number;
  turnoverRate: number;
  speed: number;
  amplitude: number;
  lastSealTime: string;
  lastBoardCount: number;
  sealStat: string;
  industry: string;
}

// 次新股
export interface SubNewStock {
  code: string;
  name: string;
  changePct: number;
  price: number;
  limitUpPrice: number;
  amount: number;
  floatMarketCap: number;
  totalMarketCap: number;
  turnoverRate: number;
  openBoardDays: number;
  openBoardDate: string;
  listDate: string;
  isNewHigh: boolean;
  sealStat: string;
  industry: string;
}

// 炸板股
export interface BrokenLimitUp {
  code: string;
  name: string;
  changePct: number;
  price: number;
  limitUpPrice: number;
  amount: number;
  floatMarketCap: number;
  totalMarketCap: number;
  turnoverRate: number;
  speed: number;
  firstSealTime: string;
  brokenCount: number;
  sealStat: number;
  amplitude: number;
  industry: string;
}

// 跌停股
export interface LimitDownStock {
  code: string;
  name: string;
  changePct: number;
  price: number;
  amount: number;
  floatMarketCap: number;
  totalMarketCap: number;
  turnoverRate: number;
  pe?: number;
  volumeRatio?: number;
  bid1?: number;
  ask1?: number;
  amplitude: number;
  industry: string;
}

function api<T>(path: string): Promise<T> {
  return fetch(`${BASE_URL}${path}`).then((res) => {
    if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
    return res.json();
  });
}

// 股票
export const marketApi = {
  getStockList: (params: { keyword?: string; page?: number; pageSize?: number }) =>
    api<{ data: { items: Stock[]; total: number } }>(
      `/stocks?${new URLSearchParams(params as any)}`
    ).then((r) => r.data),

  getStock: (code: string) =>
    api<{ data: Stock }>(`/stocks/${code}`).then((r) => r.data),

  // 历史K线
  getHistory: (code: string, params?: { startDate?: string; endDate?: string; adjust?: string }) =>
    api<{ data: HistoryData[] }>(
      `/history/${code}?${new URLSearchParams(params as any)}`
    ).then((r) => r.data),

  // 实时行情
  getRealtime: (code: string) =>
    api<{ data: RealtimeData }>(`/realtime/${code}`).then((r) => r.data),

  getRealtimeBatch: (codes: string[]) =>
    api<{ data: RealtimeData[] }>(`/realtime/batch?codes=${codes.join(',')}`).then((r) => r.data),

  // 分钟级数据
  getMinute: (code: string, period: string = '5') =>
    api<{ data: { time: string; price: number; volume: number; amount: number }[] }>(
      `/minute/${code}?period=${period}`
    ).then((r) => r.data),

  // 涨跌幅排行
  getRankings: (type: 'up' | 'down' = 'up', limit: number = 50) =>
    api<{ data: Stock[] }>(`/rankings?type=${type}&limit=${limit}`).then((r) => r.data),

  // 板块
  getSectors: (type?: string) =>
    api<{ data: Sector[] }>(`/sectors${type ? `?type=${type}` : ''}`).then((r) => r.data),

  getSectorStocks: (sectorId: string) =>
    api<{ data: Stock[] }>(`/sectors/${sectorId}/stocks`).then((r) => r.data),

  // 涨停板
  getLimitUp: (params?: { date?: string; type?: string; page?: number; pageSize?: number }) =>
    api<{ data: { items: LimitUpStock[]; total: number } }>(
      `/limitup?${new URLSearchParams(params as any)}`
    ).then((r) => r.data),

  // 热搜
  getHot: (params?: { symbol?: string; date?: string; time?: string }) =>
    api<{ data: { name: string; code: string; changePct: string; heat: number }[] }>(
      `/hot?${new URLSearchParams(params as any)}`
    ).then((r) => r.data),

  // 概念板块指数历史
  getConceptBoardIndex: (name: string, startDate?: string, endDate?: string) =>
    api<{ data: ConceptBoardIndex[] }>(
      `/concept/${encodeURIComponent(name)}/history?${new URLSearchParams({ startDate: startDate || '', endDate: endDate || '' } as any)}`
    ).then((r) => r.data),

  // 概念板块详情
  getConceptBoardInfo: (name: string) =>
    api<{ data: ConceptBoardInfo }>(`/concept/${encodeURIComponent(name)}/info`).then((r) => r.data),

  // 行业板块指数历史
  getIndustryBoardIndex: (name: string, startDate?: string, endDate?: string) =>
    api<{ data: IndustryBoardIndex[] }>(
      `/industry/${encodeURIComponent(name)}/history?${new URLSearchParams({ startDate: startDate || '', endDate: endDate || '' } as any)}`
    ).then((r) => r.data),

  // 昨日涨停股池
  getPreviousLimitUp: (date?: string) =>
    api<{ data: PreviousLimitUp[] }>(`/zt/previous${date ? `?date=${date}` : ''}`).then((r) => r.data),

  // 次新股池
  getSubNewStocks: (date?: string) =>
    api<{ data: SubNewStock[] }>(`/zt/subnew${date ? `?date=${date}` : ''}`).then((r) => r.data),

  // 炸板股池
  getBrokenLimitUp: (date?: string) =>
    api<{ data: BrokenLimitUp[] }>(`/zt/broken${date ? `?date=${date}` : ''}`).then((r) => r.data),

  // 跌停股池
  getLimitDown: (date?: string) =>
    api<{ data: LimitDownStock[] }>(`/zt/down${date ? `?date=${date}` : ''}`).then((r) => r.data),
};