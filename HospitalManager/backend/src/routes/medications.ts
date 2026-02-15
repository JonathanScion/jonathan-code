import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { getPagination, paginatedResponse } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const medicationSchema = z.object({
  name: z.string().min(1).max(200),
  genericName: z.string().max(200).optional().nullable(),
  manufacturer: z.string().max(200).optional().nullable(),
  dosageForm: z.enum(['TABLET', 'CAPSULE', 'INJECTION', 'SYRUP', 'CREAM', 'INHALER']),
  strength: z.string().min(1).max(50),
  price: z.number().min(0),
  requiresRx: z.boolean().optional(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const search = req.query.search as string | undefined;
    const where = search ? { name: { contains: search, mode: 'insensitive' as const } } : {};
    const [data, total] = await Promise.all([
      prisma.medication.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      prisma.medication.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const med = await prisma.medication.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!med) throw new AppError('Medication not found', 404);
    res.json(med);
  } catch (err) { next(err); }
});

router.post('/', validate(medicationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const med = await prisma.medication.create({ data: req.body });
    res.status(201).json(med);
  } catch (err) { next(err); }
});

router.put('/:id', validate(medicationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const med = await prisma.medication.update({ where: { id: parseInt(req.params.id) }, data: req.body });
    res.json(med);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.medication.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
