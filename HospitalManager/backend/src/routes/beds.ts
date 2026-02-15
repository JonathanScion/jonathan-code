import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { getPagination, paginatedResponse } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const bedSchema = z.object({
  number: z.string().min(1).max(10),
  type: z.enum(['STANDARD', 'ELECTRIC', 'ICU', 'PEDIATRIC']),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE']).optional(),
  roomId: z.number().int(),
});

// List — scoped to room via required ?roomId=X
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roomId = parseInt(req.query.roomId as string);
    if (isNaN(roomId)) throw new AppError('roomId query parameter is required', 400);
    const { skip, take, page, pageSize } = getPagination(req);
    const search = req.query.search as string | undefined;
    const where: any = { roomId };
    if (search) where.number = { contains: search, mode: 'insensitive' as const };
    const [data, total] = await Promise.all([
      prisma.bed.findMany({ where, skip, take, orderBy: { number: 'asc' } }),
      prisma.bed.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) { next(err); }
});

// Get by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bed = await prisma.bed.findUnique({ where: { id: parseInt(req.params.id) }, include: { room: true } });
    if (!bed) throw new AppError('Bed not found', 404);
    res.json(bed);
  } catch (err) { next(err); }
});

// Create
router.post('/', validate(bedSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bed = await prisma.bed.create({ data: req.body });
    res.status(201).json(bed);
  } catch (err) { next(err); }
});

// Update
router.put('/:id', validate(bedSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bed = await prisma.bed.update({ where: { id: parseInt(req.params.id) }, data: req.body });
    res.json(bed);
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.bed.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
