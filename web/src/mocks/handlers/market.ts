import { http, HttpResponse } from 'msw';
import { faker } from '@faker-js/faker';
import { mockStocks, mockHistoryData } from '../data/stocks';

const generateRealtime = (code: string, name: string) => {
  const price = faker.number.float({ min: 10, max: 100, fractionDigits: 2 });
  const prevClose = price - faker.number.float({ min: -5, max: 5, fractionDigits: 2 });
  const change = price - prevClose;
  const changePct = (change / prevClose) * 100;
  const high = price * faker.number.float({ min: 1.0, max: 1.1, fractionDigits: 2 });
  const low = price * faker.number.float({ min: 0.9, max: 1.0, fractionDigits: 2 });

  return {
    code,
    name,
    price,
    change: parseFloat(change.toFixed(2)),
    changePct: parseFloat(changePct.toFixed(2)),
    volume: faker.number.float({ min: 1000000, max: 100000000 }),
    amount: faker.number.float({ min: 10000000, max: 1000000000 }),
    high: parseFloat(high.toFixed(2)),
    low: parseFloat(low.toFixed(2)),
    open: faker.number.float({ min: prevClose * 0.9, max: prevClose * 1.1, fractionDigits: 2 }),
    prevClose: parseFloat(prevClose.toFixed(2)),
    amplitude: parseFloat(((high - low) / prevClose * 100).toFixed(2)),
    turnoverRate: faker.number.float({ min: 0.5, max: 15, fractionDigits: 2 }),
    pe: faker.number.float({ min: 5, max: 50, fractionDigits: 2 }),
    pb: faker.number.float({ min: 0.5, max: 5, fractionDigits: 2 }),
    marketCap: faker.number.float({ min: 1e8, max: 1e11 }),
    floatMarketCap: faker.number.float({ min: 5e7, max: 5e10 }),
    bidAsk: {
      bid1: { price: price - 0.01, vol: faker.number.int({ min: 1000, max: 50000 }) },
      bid2: { price: price - 0.02, vol: faker.number.int({ min: 1000, max: 50000 }) },
      bid3: { price: price - 0.03, vol: faker.number.int({ min: 1000, max: 50000 }) },
      bid4: { price: price - 0.04, vol: faker.number.int({ min: 1000, max: 50000 }) },
      bid5: { price: price - 0.05, vol: faker.number.int({ min: 1000, max: 50000 }) },
      ask1: { price: price + 0.01, vol: faker.number.int({ min: 1000, max: 50000 }) },
      ask2: { price: price + 0.02, vol: faker.number.int({ min: 1000, max: 50000 }) },
      ask3: { price: price + 0.03, vol: faker.number.int({ min: 1000, max: 50000 }) },
      ask4: { price: price + 0.04, vol: faker.number.int({ min: 1000, max: 50000 }) },
      ask5: { price: price + 0.05, vol: faker.number.int({ min: 1000, max: 50000 }) },
    },
    updatedAt: new Date().toISOString(),
  };
};

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

  http.get('/api/v1/market/minute/:code', () => {
    const now = Date.now();
    const data = Array.from({ length: 100 }, (_, i) => ({
      time: new Date(now - i * 60000 * 5).toISOString(),
      price: 10 + Math.random() * 2,
      volume: Math.floor(Math.random() * 10000),
      amount: Math.floor(Math.random() * 100000),
    })).reverse();
    return HttpResponse.json({ code: 0, message: 'success', data });
  }),

  http.get('/api/v1/market/sectors', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: [
        { id: '1', code: 'industry_科技', name: '科技', type: 'INDUSTRY', changePct: 2.5, riseCount: 45, fallCount: 12, leaderStock: '宁德时代', leaderStockPrice: 280.5, leaderStockChangePct: 4.2 },
        { id: '2', code: 'industry_医药', name: '医药', type: 'INDUSTRY', changePct: -1.3, riseCount: 20, fallCount: 35, leaderStock: '恒瑞医药', leaderStockPrice: 45.8, leaderStockChangePct: -2.1 },
      ],
    });
  }),

  http.get('/api/v1/market/limitup', ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '50');

    const items = Array.from({ length: 20 }, (_, i) => ({
      code: `60${String(i).padStart(4, '0')}`,
      name: `股票${i}`,
      changePct: 9.9 + Math.random(),
      price: 10 + Math.random() * 5,
      amount: Math.random() * 1e9,
      industry: '科技',
    }));

    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        items: items.slice((page - 1) * pageSize, page * pageSize),
        total: items.length,
        page,
        pageSize,
      },
    });
  }),

  http.get('/api/v1/market/hot', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: [
        { name: '比亚迪', code: '002594', changePct: '+5.2%', heat: 950000 },
        { name: '贵州茅台', code: '600519', changePct: '+2.1%', heat: 880000 },
      ],
    });
  }),
];