import { Injectable } from '@nestjs/common';
import { AktoolsAdapter } from './adapters/aktools.adapter';
import {
  SystemStock,
  SystemRealtime,
  SystemBidAsk,
  SystemHistory,
  SystemMinute,
  SystemIndustryBoard,
  SystemConceptBoard,
  SystemLimitUpStock,
  SystemHotStock,
  HistoryParams,
  HotParams,
  SystemConceptBoardIndex,
  SystemConceptBoardInfo,
  SystemIndustryBoardIndex,
  SystemPreviousLimitUp,
  SystemSubNewStock,
  SystemBrokenLimitUp,
  SystemLimitDownStock,
  BoardIndexParams,
} from './types';

@Injectable()
export class DataGateway {
  constructor(private readonly aktools: AktoolsAdapter) {}

  async getStockList() { return this.aktools.fetchStockList(); }
  async getRealtime(codes: string[]) { return this.aktools.fetchRealtime(codes); }
  async getBidAsk(code: string) { return this.aktools.fetchBidAsk(code); }
  async getHistory(params: HistoryParams) { return this.aktools.fetchHistory(params); }
  async getMinuteData(code: string) { return this.aktools.fetchMinute(code); }  // 别名：jobs 使用 getMinuteData
  async getMinute(code: string) { return this.aktools.fetchMinute(code); }
  async getIndustryBoard() { return this.aktools.fetchIndustryBoard(); }
  async getConceptBoard() { return this.aktools.fetchConceptBoard(); }
  async getLimitUpPool(date: string) { return this.aktools.fetchLimitUpPool(date); }
  async getLimitDownPool(date: string) { return this.aktools.fetchLimitDownPool(date); }
  async getStrongStocks(date: string) { return this.aktools.fetchStrongStocks(date); }
  async getBrokenStocks(date: string) { return this.aktools.fetchBrokenStocks(date); }
  async getHotStocks(params: HotParams) { return this.aktools.fetchHotStocks(params); }

  // === 新增板块接口 ===
  async getConceptBoardIndex(params: BoardIndexParams) { return this.aktools.fetchConceptBoardIndex(params); }
  async getConceptBoardInfo(name: string) { return this.aktools.fetchConceptBoardInfo(name); }
  async getIndustryBoardIndex(params: BoardIndexParams) { return this.aktools.fetchIndustryBoardIndex(params); }

  // === 新增股池接口 ===
  async getPreviousLimitUpPool(date: string) { return this.aktools.fetchPreviousLimitUpPool(date); }
  async getSubNewPool(date: string) { return this.aktools.fetchSubNewPool(date); }
  async getBrokenLimitUpPool(date: string) { return this.aktools.fetchBrokenLimitUpPool(date); }
  async getLimitDownPoolEm(date: string) { return this.aktools.fetchLimitDownPoolEm(date); }

  // === 备用数据源 ===
  async getCyASpot() { return this.aktools.fetchCyASpot(); }
  async getKcASpot() { return this.aktools.fetchKcASpot(); }
  async getSinaSpot() { return this.aktools.fetchSinaSpot(); }
  async getXueqiuSpot(code: string) { return this.aktools.fetchXueqiuSpot(code); }
}
