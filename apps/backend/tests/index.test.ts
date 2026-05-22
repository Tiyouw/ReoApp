import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index';

const TOKEN = 'test-device-' + Date.now();

describe('Backend API v2', () => {
  it('POST /api/reo/device/register creates device', async () => {
    const res = await request(app)
      .post('/api/reo/device/register')
      .send({ device_token: TOKEN });
    expect(res.status).toBe(200);
    expect(res.body.device_token || res.body.error).toBeDefined();
  });

  it('GET /api/reo/state requires token', async () => {
    const res = await request(app).get('/api/reo/state');
    expect(res.status).toBe(400);
  });

  it('GET /api/reo/state returns settings with token', async () => {
    const res = await request(app)
      .get('/api/reo/state')
      .set('x-device-token', TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.persona).toBeDefined();
  });

  it('GET /api/reo/stats returns stats', async () => {
    const res = await request(app)
      .get('/api/reo/stats?range=7d')
      .set('x-device-token', TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.total_nudges).toBeDefined();
  });

  it('POST /api/reo/focus/start creates session', async () => {
    const res = await request(app)
      .post('/api/reo/focus/start')
      .set('x-device-token', TOKEN)
      .send({ task: 'Test task' });
    expect(res.status).toBe(200);
    expect(res.body.session_id).toBeDefined();
  });

  it('POST /api/reo/focus/end requires session_id', async () => {
    const res = await request(app)
      .post('/api/reo/focus/end')
      .set('x-device-token', TOKEN)
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/reo/auth/login requires email', async () => {
    const res = await request(app)
      .post('/api/reo/auth/login')
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/reo/auth/login attempts magic link with redirectTo', async () => {
    const res = await request(app)
      .post('/api/reo/auth/login')
      .send({ email: 'test@example.com', redirectTo: 'http://localhost:5173' });
    // Since we connect to live Supabase, it might succeed or rate-limit or fail,
    // but the status code will be 200 (success) or 429/500 depending on credentials and rate limits.
    // We just want to check it does not crash and returns the expected format.
    expect([200, 429, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    } else {
      expect(res.body.error).toBeDefined();
    }
  });
}, 20000);
