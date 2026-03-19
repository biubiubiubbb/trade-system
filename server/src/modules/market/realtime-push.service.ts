import { Injectable } from '@nestjs/common';
import { SystemRealtime } from '../../services/data-gateway/types';

@Injectable()
export class RealtimePushService {
  /**
   * Get realtime snapshot for given codes from SSE push buffer.
   * Returns empty array if no buffered data available.
   */
  async getSnapshot(codes: string[]): Promise<SystemRealtime[]> {
    // TODO: Implement with SSE buffer from P4
    return [];
  }
}
