import express from 'express';
import { env } from './config/env.js';
import { createReservation, listReservations } from './services/ticket.service.js';

export const app = express();
app.set('port', env.PORT);
app.use(express.json());

function handleHealthz(_req, res) {
  return res.status(200).json({ status: 'ok', service: 'ticket-pulse-api' });
}

async function handleCreateReservation(req, res) {
  try {
    const { eventCode, attendeeEmail, seatQty, tier } = req.body ?? {};
    if (!eventCode || !attendeeEmail || seatQty === undefined) {
      return res.status(400).json({ error: 'Missing required reservation fields' });
    }
    const reservation = await createReservation({ eventCode, attendeeEmail, seatQty, tier });
    return res.status(201).json({ status: 'created', data: reservation });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

async function handleListReservations(_req, res) {
  try {
    const reservations = await listReservations();
    return res.status(200).json({ data: reservations });
  } catch (_err) {
    return res.status(500).json({ error: 'Failed to fetch reservation' });
  }
}

app.get('/healthz', handleHealthz);
app.post('/api/v1/reservations', handleCreateReservation);
app.get('/api/v1/reservations', handleListReservations);
