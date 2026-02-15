import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { getPagination, paginatedResponse } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const departmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
});

// List
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const search = req.query.search as string | undefined;
    const where = search ? { name: { contains: search, mode: 'insensitive' as const } } : {};
    const [data, total] = await Promise.all([
      prisma.department.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      prisma.department.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) { next(err); }
});

// Get by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dept = await prisma.department.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!dept) throw new AppError('Department not found', 404);
    res.json(dept);
  } catch (err) { next(err); }
});

// Create
router.post('/', validate(departmentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dept = await prisma.department.create({ data: req.body });
    res.status(201).json(dept);
  } catch (err) { next(err); }
});

// Update
router.put('/:id', validate(departmentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dept = await prisma.department.update({ where: { id: parseInt(req.params.id) }, data: req.body });
    res.json(dept);
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.department.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
