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
  // SSE Mock for realtime data
  http.get('/api/v1/market/sse/realtime', async ({ request }) => {
    const url = new URL(request.url);
    const codesParam = url.searchParams.get('codes') || '';
    const codes = codesParam.split(',').filter(Boolean);

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        // Send initial data immediately
        const sendData = () => {
          for (const code of codes) {
            const stock = mockStocks.find(s => s.code === code);
            const realtime = generateRealtime(code, stock?.name || 'Unknown');
            const line = `data: ${JSON.stringify(realtime)}\n`;
            controller.enqueue(encoder.encode(line));
          }
        };
        sendData();
        // Send updates every 2 seconds
        const interval = setInterval(() => {
          try {
            for (const code of codes) {
              const stock = mockStocks.find(s => s.code === code);
              const realtime = generateRealtime(code, stock?.name || 'Unknown');
              const line = `data: ${JSON.stringify(realtime)}\n`;
              controller.enqueue(encoder.encode(line));
            }
          } catch {
            clearInterval(interval);
            controller.close();
          }
        }, 2000);
        // Cleanup on close
        request.signal.addEventListener('abort', () => clearInterval(interval));
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }),

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
    const items = filtered.slice(start, start + pageSize).map(s => ({
      ...s,
      realtime: generateRealtime(s.code, s.name),
    }));

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

    // Generate codes that exist in mockStocks (600001-600050)
    const items = Array.from({ length: 20 }, (_, i) => ({
      code: `600${String(i + 1).padStart(3, '0')}`, // 600001-600020
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

  // 概念板块指数历史
  http.get('/api/v1/market/concept/:name/history', () => {
    const now = Date.now();
    const data = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(now - i * 24 * 60 * 60 * 1000).toISOString(),
      open: 1000 + Math.random() * 100,
      high: 1020 + Math.random() * 100,
      low: 980 + Math.random() * 100,
      close: 1000 + Math.random() * 100,
      volume: Math.floor(Math.random() * 1e8),
      amount: Math.random() * 1e11,
    })).reverse();
    return HttpResponse.json({ code: 0, message: 'success', data });
  }),

  // 概念板块详情
  http.get('/api/v1/market/concept/:name/info', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        open: 1825.71,
        prevClose: 1844.18,
        low: 1752.74,
        high: 1827.99,
        volume: 12324.70,
        changePct: '-4.96%',
        changeRank: '317/396',
        riseFallCount: '25/222',
        netInflow: -251.00,
        amount: 2167.43,
      },
    });
  }),

  // 行业板块指数历史
  http.get('/api/v1/market/industry/:name/history', () => {
    const now = Date.now();
    const data = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(now - i * 24 * 60 * 60 * 1000).toISOString(),
      open: 8000 + Math.random() * 500,
      high: 8200 + Math.random() * 500,
      low: 7800 + Math.random() * 500,
      close: 8000 + Math.random() * 500,
      volume: Math.floor(Math.random() * 5e8),
      amount: Math.random() * 1e10,
    })).reverse();
    return HttpResponse.json({ code: 0, message: 'success', data });
  }),

  // 昨日涨停股池
  http.get('/api/v1/market/zt/previous', () => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      code: `600${String(i + 1).padStart(3, '0')}`, // 600001-600010
      name: `昨日涨停${i}`,
      changePct: -5 + Math.random() * 3,
      price: 10 + Math.random() * 5,
      limitUpPrice: 10 + Math.random() * 5,
      amount: Math.random() * 1e8,
      floatMarketCap: Math.random() * 1e10,
      totalMarketCap: Math.random() * 1e11,
      turnoverRate: Math.random() * 10,
      speed: Math.random() * 2,
      amplitude: Math.random() * 10,
      lastSealTime: '09:25:00',
      lastBoardCount: 1,
      sealStat: '2/1',
      industry: '科技',
    }));
    return HttpResponse.json({ code: 0, message: 'success', data });
  }),

  // 次新股池 - 使用 mockStocks 中存在的深市股票代码
  http.get('/api/v1/market/zt/subnew', () => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      code: `000${String(i + 1).padStart(3, '0')}`, // 000001-000010
      name: `次新股${i}`,
      changePct: -10 + Math.random() * 20,
      price: 10 + Math.random() * 50,
      limitUpPrice: 10 + Math.random() * 50,
      amount: Math.random() * 1e8,
      floatMarketCap: Math.random() * 1e9,
      totalMarketCap: Math.random() * 1e10,
      turnoverRate: Math.random() * 50,
      openBoardDays: Math.floor(Math.random() * 10),
      openBoardDate: '2024-01-15',
      listDate: '2024-01-10',
      isNewHigh: Math.random() > 0.5,
      sealStat: '0/0',
      industry: '科技',
    }));
    return HttpResponse.json({ code: 0, message: 'success', data });
  }),

  // 炸板股池
  http.get('/api/v1/market/zt/broken', () => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      code: `600${String(i + 11).padStart(3, '0')}`, // 600011-600020
      name: `炸板股${i}`,
      changePct: 5 + Math.random() * 5,
      price: 10 + Math.random() * 5,
      limitUpPrice: 10 + Math.random() * 5,
      amount: Math.random() * 1e8,
      floatMarketCap: Math.random() * 1e10,
      totalMarketCap: Math.random() * 1e11,
      turnoverRate: Math.random() * 15,
      speed: Math.random() * 2,
      firstSealTime: '09:30:00',
      brokenCount: Math.floor(Math.random() * 5),
      sealStat: Math.floor(Math.random() * 5),
      amplitude: Math.random() * 15,
      industry: '科技',
    }));
    return HttpResponse.json({ code: 0, message: 'success', data });
  }),

  // 跌停股池
  http.get('/api/v1/market/zt/down', () => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      code: `600${String(i + 21).padStart(3, '0')}`, // 600021-600030
      name: `跌停股${i}`,
      changePct: -10 - Math.random(),
      price: 10 + Math.random() * 5,
      amount: Math.random() * 1e8,
      floatMarketCap: Math.random() * 1e10,
      totalMarketCap: Math.random() * 1e11,
      turnoverRate: Math.random() * 10,
      pe: Math.random() * 50,
      volumeRatio: Math.random() * 3,
      bid1: 0,
      ask1: 0,
      amplitude: Math.random() * 5,
      industry: '科技',
    }));
    return HttpResponse.json({ code: 0, message: 'success', data });
  }),
];