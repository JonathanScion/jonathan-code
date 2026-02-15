import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { getPagination, paginatedResponse } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const roomSchema = z.object({
  number: z.string().min(1).max(10),
  floor: z.number().int().min(0).max(50),
  type: z.enum(['WARD', 'PRIVATE', 'ICU', 'OPERATING', 'EMERGENCY']),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE']).optional(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const search = req.query.search as string | undefined;
    const where = search ? { number: { contains: search, mode: 'insensitive' as const } } : {};
    const [data, total] = await Promise.all([
      prisma.room.findMany({ where, skip, take, orderBy: { number: 'asc' }, include: { _count: { select: { beds: true } } } }),
      prisma.room.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const room = await prisma.room.findUnique({ where: { id: parseInt(req.params.id) }, include: { beds: true } });
    if (!room) throw new AppError('Room not found', 404);
    res.json(room);
  } catch (err) { next(err); }
});

router.post('/', validate(roomSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const room = await prisma.room.create({ data: req.body });
    res.status(201).json(room);
  } catch (err) { next(err); }
});

router.put('/:id', validate(roomSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const room = await prisma.room.update({ where: { id: parseInt(req.params.id) }, data: req.body });
    res.json(room);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.room.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
