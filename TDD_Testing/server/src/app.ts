import cors from 'cors';
import express from 'express';
import { clientsRouter } from './routes/clients.js';
import { lookupsRouter } from './routes/lookups.js';
import { seed } from './data/store.js';
import { seedClients } from './data/seed.js';

export function createApp(): express.Express {
  seed(seedClients);

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/clients', clientsRouter);
  app.use('/api/lookups', lookupsRouter);

  return app;
}
