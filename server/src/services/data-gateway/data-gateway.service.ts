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
}
