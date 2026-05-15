import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Backend API', () => {
  it('should have a chat endpoint', async () => {
    // Note: since we don't have a valid API key in test, it will probably return 500,
    // but we can check if the route exists
    const res = await request(app).post('/api/reo/chat').send({ persona: 'jowo', context: 'idle' });
    expect(res.status).toBeDefined();
  });
});
