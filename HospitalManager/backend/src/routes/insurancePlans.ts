import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { getPagination, paginatedResponse } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const insurancePlanSchema = z.object({
  name: z.string().min(1).max(200),
  provider: z.string().min(1).max(200),
  type: z.enum(['HMO', 'PPO', 'EPO', 'POS']),
  coverageLevel: z.enum(['BASIC', 'STANDARD', 'PREMIUM']),
  monthlyPremium: z.number().min(0),
  deductible: z.number().min(0),
  maxCoverage: z.number().min(0),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const search = req.query.search as string | undefined;
    const where = search ? { name: { contains: search, mode: 'insensitive' as const } } : {};
    const [data, total] = await Promise.all([
      prisma.insurancePlan.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      prisma.insurancePlan.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.insurancePlan.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!plan) throw new AppError('Insurance plan not found', 404);
    res.json(plan);
  } catch (err) { next(err); }
});

router.post('/', validate(insurancePlanSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.insurancePlan.create({ data: req.body });
    res.status(201).json(plan);
  } catch (err) { next(err); }
});

router.put('/:id', validate(insurancePlanSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.insurancePlan.update({ where: { id: parseInt(req.params.id) }, data: req.body });
    res.json(plan);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.insurancePlan.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
