import { faker } from '@faker-js/faker';

faker.seed(12345);

export const mockStocks = Array.from({ length: 100 }, (_, i) => ({
  code: `${i < 50 ? '600' : '000'}${String(i + 1).padStart(3, '0')}`,
  name: faker.company.name() + (i < 50 ? 'A' : 'B'),
  market: i < 50 ? 'SH' : 'SZ',
  industry: faker.helpers.arrayElement(['科技', '金融', '消费', '医药', '工业']),
  listDate: faker.date.past({ years: 10 }).toISOString().split('T')[0],
}));

export const mockHistoryData = (code: string) =>
  Array.from({ length: 100 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (99 - i));
    const open = faker.number.float({ min: 10, max: 100, fractionDigits: 2 });
    const close = open + faker.number.float({ min: -5, max: 5, fractionDigits: 2 });
    return {
      code,
      date: date.toISOString().split('T')[0],
      open,
      high: Math.max(open, close) + faker.number.float({ min: 0, max: 2, fractionDigits: 2 }),
      low: Math.min(open, close) - faker.number.float({ min: 0, max: 2, fractionDigits: 2 }),
      close,
      volume: faker.number.float({ min: 1000000, max: 100000000 }),
      amount: faker.number.float({ min: 10000000, max: 1000000000 }),
      turnover: faker.number.float({ min: 0.1, max: 20, fractionDigits: 2 }),
      adjust: 'None',
    };
  });
