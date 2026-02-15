import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { getPagination, paginatedResponse } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const prescriptionItemSchema = z.object({
  prescriptionId: z.number().int().positive(),
  medicationId: z.number().int().positive(),
  dosage: z.string().min(1).max(100),
  frequency: z.string().min(1).max(100),
  duration: z.string().min(1).max(100),
  quantity: z.number().int().positive(),
  instructions: z.string().max(500).optional().nullable(),
});

// List
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const where: any = {};
    if (req.query.prescriptionId) where.prescriptionId = parseInt(req.query.prescriptionId as string);
    const [data, total] = await Promise.all([
      prisma.prescriptionItem.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { medication: true },
      }),
      prisma.prescriptionItem.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) { next(err); }
});

// Get by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.prescriptionItem.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { medication: true, prescription: true },
    });
    if (!item) throw new AppError('Prescription item not found', 404);
    res.json(item);
  } catch (err) { next(err); }
});

// Create
router.post('/', validate(prescriptionItemSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.prescriptionItem.create({
      data: req.body,
      include: { medication: true },
    });
    res.status(201).json(item);
  } catch (err) { next(err); }
});

// Update
router.put('/:id', validate(prescriptionItemSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.prescriptionItem.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
      include: { medication: true },
    });
    res.json(item);
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.prescriptionItem.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
