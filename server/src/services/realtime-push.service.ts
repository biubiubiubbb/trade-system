import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { flatMap } from 'rxjs/operators';
import { RedisService } from './redis.service';
import { SystemRealtime } from './data-gateway/types';

interface RealtimeEvent {
  codes: string[];
  data: SystemRealtime[];
}

@Injectable()
export class RealtimePushService {
  private readonly logger = new Logger(RealtimePushService.name);
  private readonly subject = new Subject<RealtimeEvent>();

  constructor(private readonly redis: RedisService) {}

  /**
   * SSE endpoint: filter by codes.
   * Each SSE message is a JSON object, frontend parses line by line.
   */
  sse(codes: string[]): Observable<MessageEvent> {
    const codeSet = codes?.length > 0 ? new Set(codes) : null;

    return this.subject.asObservable().pipe(
      flatMap((event) => {
        const items = codeSet
          ? event.data.filter((d) => codeSet.has(d.code))
          : event.data;

        // Each stock generates one SSE message, frontend splits by \n
        return items.map((d) => new MessageEvent('message', { data: JSON.stringify(d) }));
      }),
    );
  }

  /**
   * Push data (called by Job).
   */
  push(data: SystemRealtime[]): void {
    if (data.length === 0) return;
    this.subject.next({ codes: data.map((d) => d.code), data });
  }

  /**
   * Get current snapshot from Redis batch read.
   */
  async getSnapshot(codes: string[]): Promise<SystemRealtime[]> {
    if (codes.length === 0) return [];

    const keys = codes.map((code) => `realtime:${code}`);
    const values = await this.redis.mgetBatch(keys);

    return values
      .filter(Boolean)
      .map((v) => JSON.parse(v) as SystemRealtime);
  }
}