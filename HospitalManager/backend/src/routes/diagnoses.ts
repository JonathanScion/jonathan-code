import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { getPagination, paginatedResponse } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const diagnosisSchema = z.object({
  visitId: z.number().int().positive(),
  code: z.string().min(1).max(20),
  description: z.string().min(1).max(500),
  type: z.enum(['PRIMARY', 'SECONDARY', 'DIFFERENTIAL']),
  notes: z.string().max(2000).optional().nullable(),
});

// List
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const where: any = {};
    if (req.query.visitId) where.visitId = parseInt(req.query.visitId as string);
    const [data, total] = await Promise.all([
      prisma.diagnosis.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.diagnosis.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) { next(err); }
});

// Get by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const diagnosis = await prisma.diagnosis.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { visit: true },
    });
    if (!diagnosis) throw new AppError('Diagnosis not found', 404);
    res.json(diagnosis);
  } catch (err) { next(err); }
});

// Create
router.post('/', validate(diagnosisSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const diagnosis = await prisma.diagnosis.create({ data: req.body });
    res.status(201).json(diagnosis);
  } catch (err) { next(err); }
});

// Update
router.put('/:id', validate(diagnosisSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const diagnosis = await prisma.diagnosis.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
    });
    res.json(diagnosis);
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.diagnosis.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
