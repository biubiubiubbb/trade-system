import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { ServicesModule } from './services/services.module';
import { MarketModule } from './modules/market/market.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    ServicesModule,
    MarketModule,
    JobsModule,
  ],
})
export class AppModule {}
