import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MarketService } from './market.service';
import { StockListQueryDto } from './dto/stock.dto';
import { HistoryQueryDto } from './dto/history-query.dto';
import { SectorQueryDto } from './dto/sector.dto';
import { LimitUpQueryDto } from './dto/limit-up.dto';

@ApiTags('行情')
@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('stocks')
  @ApiOperation({ summary: '获取股票列表' })
  async getStockList(@Query() query: StockListQueryDto) {
    const result = await this.marketService.getStockList(query);
    return { code: 0, message: 'success', data: result };
  }

  @Get('stocks/:code')
  @ApiOperation({ summary: '获取股票详情' })
  async getStock(@Param('code') code: string) {
    const stock = await this.marketService.getStock(code);
    if (!stock) {
      throw new NotFoundException({ code: 1002, message: 'Stock not found', data: null });
    }
    return { code: 0, message: 'success', data: stock };
  }

  @Get('history/:code')
  @ApiOperation({ summary: '获取历史行情' })
  async getHistory(@Param('code') code: string, @Query() query: Omit<HistoryQueryDto, 'code'>) {
    const data = await this.marketService.getHistory({ code, ...query });
    return { code: 0, message: 'success', data };
  }

  @Get('realtime/:code')
  @ApiOperation({ summary: '获取实时行情' })
  async getRealtime(@Param('code') code: string) {
    const data = await this.marketService.getRealtime(code);
    if (!data) {
      throw new NotFoundException({ code: 1002, message: 'Realtime data not found', data: null });
    }
    return { code: 0, message: 'success', data };
  }

  @Get('realtime/batch')
  @ApiOperation({ summary: '批量获取实时行情' })
  async getRealtimeBatch(@Query('codes') codes: string) {
    const codeList = codes.split(',');
    const data = await this.marketService.getRealtimeBatch(codeList);
    return { code: 0, message: 'success', data };
  }

  @Get('rankings')
  @ApiOperation({ summary: '获取涨跌幅排行' })
  async getRankings(
    @Query('limit') limit: number = 50,
    @Query('type') type: 'up' | 'down' = 'up',
  ) {
    const data = await this.marketService.getRankings(type, limit);
    return { code: 0, message: 'success', data };
  }

  @Get('minute/:code')
  @ApiOperation({ summary: '获取分钟级数据（按需，不存储）' })
  async getMinuteData(@Param('code') code: string) {
    const data = await this.marketService.getMinuteData(code);
    return { code: 0, message: 'success', data };
  }

  @Get('sectors')
  @ApiOperation({ summary: '获取板块列表' })
  async getSectors(@Query() query: SectorQueryDto) {
    const data = await this.marketService.getSectors(query);
    return { code: 0, message: 'success', data };
  }

  @Get('sectors/:id/stocks')
  @ApiOperation({ summary: '获取板块成分股' })
  async getSectorStocks(@Param('id') id: string) {
    const data = await this.marketService.getSectorStocks(id);
    return { code: 0, message: 'success', data };
  }

  @Get('sectors/:id/history')
  @ApiOperation({ summary: '获取板块指数历史' })
  async getSectorHistory(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.marketService.getSectorHistory(id, startDate, endDate);
    return { code: 0, message: 'success', data };
  }

  @Get('limitup')
  @ApiOperation({ summary: '获取涨停板数据' })
  async getLimitUp(@Query() query: LimitUpQueryDto) {
    const result = await this.marketService.getLimitUp(query);
    return { code: 0, message: 'success', data: result };
  }

  @Get('hot')
  @ApiOperation({ summary: '获取热搜股票' })
  async getHotStocks(@Query('symbol') symbol?: string) {
    const data = await this.marketService.getHotStocks(symbol || 'A股', '', '今日');
    return { code: 0, message: 'success', data };
  }
}
