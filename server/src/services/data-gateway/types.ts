// === 系统标准数据结构 ===

export interface SystemStock {
  code: string;
  name: string;
  market: 'SH' | 'SZ';
  industry?: string;
}

export interface SystemRealtime {
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
  bidAsk?: SystemBidAsk;
  updatedAt: Date;
}

export interface SystemBidAsk {
  bid1: { price: number; vol: number };
  bid2: { price: number; vol: number };
  bid3: { price: number; vol: number };
  bid4: { price: number; vol: number };
  bid5: { price: number; vol: number };
  ask1: { price: number; vol: number };
  ask2: { price: number; vol: number };
  ask3: { price: number; vol: number };
  ask4: { price: number; vol: number };
  ask5: { price: number; vol: number };
}

export interface SystemHistory {
  code: string;
  date: Date;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  turnover?: number;
  adjust: 'None' | 'Forward' | 'Backward';
}

export interface SystemMinute {
  time: string;
  price: number;
  volume: number;
  amount: number;
}

export interface SystemIndustryBoard {
  name: string;
  changePct: number;
  volume: number;
  amount: number;
  netInflow: number;
  riseCount: number;
  fallCount: number;
  leaderStock: string;
  leaderStockPrice: number;
  leaderStockChangePct: number;
}

export interface SystemConceptBoard {
  name: string;
  changePct: number;
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
}

export interface SystemLimitUpStock {
  code: string;
  name: string;
  changePct: number;
  price: number;
  amount: number;
  floatMarketCap?: number;
  totalMarketCap?: number;
  turnoverRate?: number;
  sealAmount?: number;
  firstSealTime?: string;
  lastSealTime?: string;
  brokenCount?: number;
  continueBoard?: number;
  industry?: string;
}

export interface SystemHotStock {
  name: string;
  code: string;
  changePct: string;
  heat: number;
}

// === 请求参数类型 ===

export interface HistoryParams {
  code: string;
  startDate: string; // YYYYMMDD 格式
  endDate: string;   // YYYYMMDD 格式
  adjust?: 'None' | 'Forward' | 'Backward';
}

export interface MinuteParams {
  code: string;
  period: '1' | '5' | '15' | '30' | '60';
}

export interface HotParams {
  symbol: string; // 默认 'A股'
}

// === 新增接口类型 ===

// 概念板块指数历史
export interface SystemConceptBoardIndex {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
}

// 概念板块详情
export interface SystemConceptBoardInfo {
  open?: number;
  prevClose?: number;
  low?: number;
  high?: number;
  volume?: number; // 万手
  changePct?: string; // 涨幅%
  changeRank?: string; // 涨幅排名
  riseFallCount?: string; // 涨跌家数
  netInflow?: number; // 资金净流入(亿)
  amount?: number; // 成交额(亿)
}

// 行业板块指数历史
export interface SystemIndustryBoardIndex {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
}

// 昨日涨停股池
export interface SystemPreviousLimitUp {
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

// 次新股池
export interface SystemSubNewStock {
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

// 炸板股池
export interface SystemBrokenLimitUp {
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

// 跌停股池
export interface SystemLimitDownStock {
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

// 超跌股池
export interface SystemBrokenStocks {
  code: string;
  name: string;
  changePct: number;
  price: number;
  amount: number;
  floatMarketCap: number;
  totalMarketCap: number;
  turnoverRate: number;
  pe: number;
  pb: number;
  industry: string;
}

// 板块历史参数
export interface BoardIndexParams {
  name: string; // 板块名称
  startDate: string;
  endDate: string;
}
