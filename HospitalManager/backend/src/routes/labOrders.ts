import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { getPagination, paginatedResponse } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const labOrderSchema = z.object({
  visitId: z.number().int().positive(),
  testName: z.string().min(1).max(200),
  category: z.enum(['BLOOD', 'URINE', 'IMAGING', 'BIOPSY', 'OTHER']),
  priority: z.enum(['STAT', 'URGENT', 'ROUTINE']).optional(),
  status: z.enum(['ORDERED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

const statusTransitions: Record<string, string[]> = {
  ORDERED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const statusSchema = z.object({
  status: z.enum(['ORDERED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
});

// List
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const where: any = {};
    if (req.query.visitId) where.visitId = parseInt(req.query.visitId as string);
    if (req.query.status) where.status = req.query.status as string;
    const [data, total] = await Promise.all([
      prisma.labOrder.findMany({
        where,
        skip,
        take,
        orderBy: { orderedAt: 'desc' },
      }),
      prisma.labOrder.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) { next(err); }
});

// Get by ID (includes results)
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const labOrder = await prisma.labOrder.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { results: true, visit: true },
    });
    if (!labOrder) throw new AppError('Lab order not found', 404);
    res.json(labOrder);
  } catch (err) { next(err); }
});

// Create
router.post('/', validate(labOrderSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = {
      ...req.body,
      status: req.body.status || 'ORDERED',
      priority: req.body.priority || 'ROUTINE',
    };
    const labOrder = await prisma.labOrder.create({ data });
    res.status(201).json(labOrder);
  } catch (err) { next(err); }
});

// Update
router.put('/:id', validate(labOrderSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const labOrder = await prisma.labOrder.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
    });
    res.json(labOrder);
  } catch (err) { next(err); }
});

// Status transition
router.patch('/:id/status', validate(statusSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const labOrder = await prisma.labOrder.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!labOrder) throw new AppError('Lab order not found', 404);

    const allowed = statusTransitions[labOrder.status] || [];
    if (!allowed.includes(req.body.status)) {
      throw new AppError(
        `Cannot transition from ${labOrder.status} to ${req.body.status}. Allowed: ${allowed.join(', ') || 'none'}`,
        400,
      );
    }

    const updateData: any = { status: req.body.status };
    if (req.body.status === 'COMPLETED') {
      updateData.completedAt = new Date();
    }

    const updated = await prisma.labOrder.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
      include: { results: true },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.labOrder.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
