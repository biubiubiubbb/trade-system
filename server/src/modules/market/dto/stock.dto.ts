import { ApiProperty } from '@nestjs/swagger';

export class StockDto {
  @ApiProperty({ description: '股票代码' })
  code: string;

  @ApiProperty({ description: '股票名称' })
  name: string;

  @ApiProperty({ description: '市场', enum: ['SH', 'SZ'] })
  market: string;

  @ApiProperty({ description: '行业', required: false })
  industry?: string;

  @ApiProperty({ description: '上市日期', required: false })
  listDate?: Date;
}

export class StockListQueryDto {
  @ApiProperty({ description: '搜索关键字', required: false })
  keyword?: string;

  @ApiProperty({ description: '市场', enum: ['SH', 'SZ'], required: false })
  market?: string;

  @ApiProperty({ description: '行业', required: false })
  industry?: string;

  @ApiProperty({ description: '页码', default: 1 })
  page?: number = 1;

  @ApiProperty({ description: '每页数量', default: 20 })
  pageSize?: number = 20;
}

export class StockListResponseDto {
  @ApiProperty({ type: [StockDto] })
  items: StockDto[];

  @ApiProperty({ description: '总数' })
  total: number;

  @ApiProperty({ description: '页码' })
  page: number;

  @ApiProperty({ description: '每页数量' })
  pageSize: number;
}
