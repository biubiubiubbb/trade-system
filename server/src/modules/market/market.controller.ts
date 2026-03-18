import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MarketService } from './market.service';
import { StockListQueryDto } from './dto/stock.dto';
import { HistoryQueryDto } from './dto/history-query.dto';

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
    const data = await this.marketService.getRankings(limit, type);
    return { code: 0, message: 'success', data };
  }
}
