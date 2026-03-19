import { ApiProperty } from '@nestjs/swagger';

export class SectorDto {
  @ApiProperty({ description: '板块ID' })
  id: string;

  @ApiProperty({ description: '板块代码' })
  code: string;

  @ApiProperty({ description: '板块名称' })
  name: string;

  @ApiProperty({ description: '板块类型', enum: ['INDUSTRY', 'CONCEPT'] })
  type: string;
}

export class SectorQueryDto {
  @ApiProperty({ description: '板块类型', enum: ['INDUSTRY', 'CONCEPT'], required: false })
  type?: string;
}
