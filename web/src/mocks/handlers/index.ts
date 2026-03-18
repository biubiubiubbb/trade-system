import { marketHandlers } from './market';
import { accountHandlers } from './account';

export const handlers = [...marketHandlers, ...accountHandlers];
