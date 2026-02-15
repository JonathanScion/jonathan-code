import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { getPagination, paginatedResponse } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const labResultSchema = z.object({
  labOrderId: z.number().int().positive(),
  parameter: z.string().min(1).max(200),
  value: z.string().min(1).max(200),
  unit: z.string().max(50).optional().nullable(),
  normalRange: z.string().max(100).optional().nullable(),
  isAbnormal: z.boolean(),
});

// List
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const where: any = {};
    if (req.query.labOrderId) where.labOrderId = parseInt(req.query.labOrderId as string);
    const [data, total] = await Promise.all([
      prisma.labResult.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.labResult.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) { next(err); }
});

// Get by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.labResult.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { labOrder: true },
    });
    if (!result) throw new AppError('Lab result not found', 404);
    res.json(result);
  } catch (err) { next(err); }
});

// Create
router.post('/', validate(labResultSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.labResult.create({ data: req.body });
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// Update
router.put('/:id', validate(labResultSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.labResult.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.labResult.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
