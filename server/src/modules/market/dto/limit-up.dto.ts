import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt } from 'class-validator';

export class LimitUpQueryDto {
  @ApiProperty({ description: '日期，格式 YYYY-MM-DD', required: false })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiProperty({ description: '类型', enum: ['LIMIT_UP', 'LIMIT_DOWN', 'PREV_LIMIT_UP', 'STRONG', 'BROKEN'], default: 'LIMIT_UP' })
  @IsOptional()
  @IsString()
  type?: string = 'LIMIT_UP';

  @ApiProperty({ description: '页码', default: 1 })
  @IsOptional()
  @IsInt()
  page?: number = 1;

  @ApiProperty({ description: '每页数量', default: 50 })
  @IsOptional()
  @IsInt()
  pageSize?: number = 50;
}

export class LimitUpStockDto {
  @ApiProperty({ description: '股票代码' })
  code: string;

  @ApiProperty({ description: '股票名称' })
  name: string;

  @ApiProperty({ description: '涨跌幅 (%)' })
  changePct: number;

  @ApiProperty({ description: '最新价' })
  price: number;

  @ApiProperty({ description: '成交额' })
  amount: number;

  @ApiProperty({ description: '流通市值' })
  floatMarketCap?: number;

  @ApiProperty({ description: '总市值' })
  totalMarketCap?: number;

  @ApiProperty({ description: '换手率' })
  turnoverRate?: number;

  @ApiProperty({ description: '封板资金' })
  sealAmount?: number;

  @ApiProperty({ description: '首次封板时间' })
  firstSealTime?: string;

  @ApiProperty({ description: '最后封板时间' })
  lastSealTime?: string;

  @ApiProperty({ description: '炸板次数' })
  brokenCount?: number;

  @ApiProperty({ description: '连板数' })
  continueBoard?: number;

  @ApiProperty({ description: '所属行业' })
  industry?: string;
}
