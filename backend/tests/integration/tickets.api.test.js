import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../src/infra/db.js', () => ({
  query: vi.fn()
}));

vi.mock('../../src/infra/redis.js', () => ({
  getQuota: vi.fn(),
  reserveQuota: vi.fn()
}));

import { query } from '../../src/infra/db.js';
import { getQuota, reserveQuota } from '../../src/infra/redis.js';
import { app } from '../../src/app.js';

describe('Tickets API integration tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /healthz returns service status ok', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'ticket-pulse-api' });
  });

  it('POST /api/v1/reservations creates a reservation and returns 201', async () => {
    getQuota.mockResolvedValue(null);
    reserveQuota.mockResolvedValue(null);
    const created = {
      id: 10,
      event_code: 'DEVOPS-DAY',
      attendee_email: 'student@campus.ac.id',
      seat_qty: 4,
      total_price: 540000,
      status: 'CONFIRMED'
    };
    query.mockResolvedValue({ rows: [created] });

    const res = await request(app).post('/api/v1/reservations').send({
      eventCode: 'DEVOPS-DAY',
      attendeeEmail: 'student@campus.ac.id',
      seatQty: 4,
      tier: 'REGULAR'
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ status: 'created', data: created });
  });

  it('POST /api/v1/reservations returns 400 when required fields are missing or invalid', async () => {
    const missingRes = await request(app).post('/api/v1/reservations').send({
      eventCode: 'DEVOPS-DAY'
    });
    expect(missingRes.status).toBe(400);
    expect(missingRes.body.error).toBe('Missing required reservation fields');

    const invalidRes = await request(app).post('/api/v1/reservations').send({
      eventCode: 'DEVOPS-DAY',
      attendeeEmail: 'student@campus.ac.id',
      seatQty: 99,
      tier: 'VIP'
    });
    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.error).toBe('Invalid seat quantity');
  });

  it('GET /api/v1/reservations returns 200 with list of reservations', async () => {
    const rows = [{ id: 1, event_code: 'DEVOPS-DAY', seat_qty: 2 }];
    query.mockResolvedValue({ rows });

    const res = await request(app).get('/api/v1/reservations');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: rows });
  });

  it('GET /api/v1/reservations returns 500 if database query fails', async () => {
    query.mockRejectedValue(new Error('DB connection lost'));

    const res = await request(app).get('/api/v1/reservations');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to fetch reservation' });
  });
});
