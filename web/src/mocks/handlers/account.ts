import { http, HttpResponse } from 'msw';
import { faker } from '@faker-js/faker';

const mockAccounts = [
  { id: 'acc-001', name: '主账户', initialFund: 100000, cash: 85000, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'acc-002', name: '激进账户', initialFund: 50000, cash: 42000, createdAt: '2024-01-15T00:00:00Z', updatedAt: '2024-01-15T00:00:00Z' },
];

export const accountHandlers = [
  http.get('/api/v1/accounts', () => {
    return HttpResponse.json({ code: 0, message: 'success', data: mockAccounts });
  }),

  http.post('/api/v1/accounts', async ({ request }) => {
    const body = await request.json() as { name: string; initialFund: number };
    const newAccount = {
      id: faker.string.uuid(),
      name: body.name,
      initialFund: body.initialFund,
      cash: body.initialFund,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockAccounts.push(newAccount);
    return HttpResponse.json({ code: 0, message: 'success', data: newAccount });
  }),

  http.get('/api/v1/accounts/:id', ({ params }) => {
    const account = mockAccounts.find((a) => a.id === params.id);
    if (!account) {
      return HttpResponse.json({ code: 1002, message: 'Account not found', data: null }, { status: 404 });
    }
    return HttpResponse.json({ code: 0, message: 'success', data: account });
  }),
];
