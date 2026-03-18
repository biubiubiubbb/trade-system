import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class HistoryQueryDto {
  @ApiProperty({ description: '股票代码' })
  @IsString()
  code: string;

  @ApiProperty({ description: '开始日期', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: '结束日期', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: '复权类型', enum: ['None', 'Forward', 'Backward'], default: 'None' })
  @IsOptional()
  adjust?: 'None' | 'Forward' | 'Backward' = 'None';
}
