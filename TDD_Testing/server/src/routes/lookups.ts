import { Router } from 'express';
import { getLookups } from '../services/lookups.js';

export const lookupsRouter = Router();

lookupsRouter.get('/', (_req, res) => {
  res.json(getLookups());
});
