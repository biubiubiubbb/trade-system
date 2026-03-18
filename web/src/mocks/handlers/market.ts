import { http, HttpResponse } from 'msw';
import { faker } from '@faker-js/faker';
import { mockStocks, mockHistoryData } from '../data/stocks';

const generateRealtime = (code: string, name: string) => ({
  code,
  name,
  price: faker.number.float({ min: 10, max: 100, fractionDigits: 2 }),
  change: faker.number.float({ min: -5, max: 5, fractionDigits: 2 }),
  changePct: faker.number.float({ min: -10, max: 10, fractionDigits: 2 }),
  volume: faker.number.float({ min: 1000000, max: 100000000 }),
  amount: faker.number.float({ min: 10000000, max: 1000000000 }),
  high: faker.number.float({ min: 50, max: 110, fractionDigits: 2 }),
  low: faker.number.float({ min: 5, max: 50, fractionDigits: 2 }),
  open: faker.number.float({ min: 10, max: 100, fractionDigits: 2 }),
  prevClose: faker.number.float({ min: 10, max: 100, fractionDigits: 2 }),
  bid1: faker.number.float({ min: 10, max: 100, fractionDigits: 2 }),
  ask1: faker.number.float({ min: 10, max: 100, fractionDigits: 2 }),
  updatedAt: new Date().toISOString(),
});

export const marketHandlers = [
  http.get('/api/v1/market/stocks', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword');
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');

    let filtered = mockStocks;
    if (keyword) {
      filtered = mockStocks.filter(
        (s) => s.code.includes(keyword) || s.name.includes(keyword),
      );
    }

    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: { items, total: filtered.length, page, pageSize },
    });
  }),

  http.get('/api/v1/market/stocks/:code', ({ params }) => {
    const stock = mockStocks.find((s) => s.code === params.code);
    if (!stock) {
      return HttpResponse.json(
        { code: 1002, message: 'Stock not found', data: null },
        { status: 404 },
      );
    }
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: { ...stock, realtime: generateRealtime(stock.code, stock.name) },
    });
  }),

  http.get('/api/v1/market/history/:code', ({ params }) => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: mockHistoryData(params.code as string),
    });
  }),

  http.get('/api/v1/market/realtime/:code', ({ params }) => {
    const stock = mockStocks.find((s) => s.code === params.code);
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: generateRealtime(params.code as string, stock?.name || 'Unknown'),
    });
  }),

  http.get('/api/v1/market/realtime/batch', ({ request }) => {
    const url = new URL(request.url);
    const codes = url.searchParams.get('codes')?.split(',') || [];
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: codes.map((code) => {
        const stock = mockStocks.find((s) => s.code === code);
        return generateRealtime(code, stock?.name || 'Unknown');
      }),
    });
  }),

  http.get('/api/v1/market/rankings', ({ request }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const type = url.searchParams.get('type') || 'up';

    const stocks = mockStocks.slice(0, limit).map((s) => ({
      ...s,
      realtime: generateRealtime(s.code, s.name),
    }));

    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: type === 'up'
        ? stocks.sort((a, b) => b.realtime.changePct - a.realtime.changePct)
        : stocks.sort((a, b) => a.realtime.changePct - b.realtime.changePct),
    });
  }),
];
