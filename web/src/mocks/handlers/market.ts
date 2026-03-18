import { http, HttpResponse } from 'msw';
import { mockStocks, mockHistoryData } from '../data/stocks';

const generateRealtime = (code: string, name: string) => ({
  code,
  name,
  price: 50 + Math.random() * 10,
  change: (Math.random() - 0.5) * 5,
  changePct: (Math.random() - 0.5) * 10,
  volume: Math.random() * 100000000,
  amount: Math.random() * 1000000000,
  high: 50 + Math.random() * 15,
  low: 50 - Math.random() * 5,
  open: 50 + Math.random() * 3,
  prevClose: 50,
  bid1: 50 - 0.01,
  ask1: 50 + 0.01,
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
];
